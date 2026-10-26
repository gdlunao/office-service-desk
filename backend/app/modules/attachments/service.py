from dataclasses import dataclass
from pathlib import Path

from app.modules.attachments.repository import AttachmentRepository
from app.modules.attachments.schemas import AttachmentResponse
from app.modules.attachments.storage import (
    LocalAttachmentStorage,
    StoredAttachment,
)
from app.modules.incidents.models import Incident, IncidentStatus
from app.modules.incidents.repository import IncidentRepository
from app.modules.users.enums import UserRole
from app.modules.users.models import User

import logging

from app.modules.attachments.models import IncidentAttachment
from app.modules.attachments.validators import validate_attachment

logger = logging.getLogger(__name__)

class AttachmentNotFoundError(Exception):
    pass

class AttachmentLimitReachedError(Exception):
    pass

class AttachmentUploadConflictError(Exception):
    pass

@dataclass(frozen=True)
class AttachmentDownload:
    path: Path
    filename: str
    content_type: str


class AttachmentService:
    def __init__(
        self,
        repository: AttachmentRepository,
        incident_repository: IncidentRepository,
        storage: LocalAttachmentStorage,
    ) -> None:
        if repository.session is not incident_repository.session:
            raise ValueError(
                "Los repositorios deben compartir la misma sesión."
            )

        self.repository = repository
        self.incident_repository = incident_repository
        self.storage = storage


    def upload_attachment(
        self,
        *,
        incident_id: int,
        current_user: User,
        filename: str,
        content: bytes,
        max_files_per_incident: int,
        max_file_size_bytes: int,
    ) -> AttachmentResponse:
        if max_files_per_incident < 1:
            raise ValueError(
                "El límite de archivos debe ser positivo."
            )

        session = self.repository.session
        stored: StoredAttachment | None = None

        try:
            self._get_accessible_incident(
                incident_id=incident_id,
                current_user=current_user,
            )

            validated = validate_attachment(
                filename=filename,
                content=content,
                max_size_bytes=max_file_size_bytes,
            )

            incident = (
                self.incident_repository.get_by_id_for_update(
                    incident_id
                )
            )

            if (
                incident is None
                or not current_user.is_active
                or not self._can_access(incident, current_user)
            ):
                raise AttachmentNotFoundError(
                    "La incidencia no está disponible."
                )

            if incident.status == IncidentStatus.CLOSED:
                raise AttachmentUploadConflictError(
                    "No se pueden añadir archivos a una "
                    "incidencia cerrada."
                )

            attachment_count = (
                self.repository.count_by_incident_for_update(
                    incident_id
                )
            )

            if attachment_count >= max_files_per_incident:
                raise AttachmentLimitReachedError(
                    "La incidencia alcanzó el límite de "
                    f"{max_files_per_incident} archivos."
                )

            stored = self.storage.save(content)

            attachment = IncidentAttachment(
                incident_id=incident.id,
                uploaded_by_id=current_user.id,
                original_filename=validated.original_filename,
                storage_key=stored.storage_key,
                content_type=validated.content_type,
                file_size_bytes=stored.file_size_bytes,
                sha256=stored.sha256,
            )

            self.repository.add(attachment)

            response = AttachmentResponse.model_validate(
                attachment
            )

            session.commit()

            return response

        except Exception:
            try:
                session.rollback()
            finally:
                if stored is not None:
                    try:
                        self.storage.delete(stored.storage_key)
                    except OSError:
                        logger.exception(
                            "No se pudo limpiar un adjunto "
                            "después de una carga fallida."
                        )

            raise

    def list_attachments(
        self,
        *,
        incident_id: int,
        current_user: User,
        offset: int = 0,
        limit: int = 20,
    ) -> list[AttachmentResponse]:
        self._validate_pagination(offset, limit)

        self._get_accessible_incident(
            incident_id=incident_id,
            current_user=current_user,
        )

        attachments = self.repository.list_by_incident(
            incident_id=incident_id,
            offset=offset,
            limit=limit,
        )

        return [
            AttachmentResponse.model_validate(attachment)
            for attachment in attachments
        ]

    def get_download(
        self,
        *,
        incident_id: int,
        attachment_id: int,
        current_user: User,
    ) -> AttachmentDownload:
        self._get_accessible_incident(
            incident_id=incident_id,
            current_user=current_user,
        )

        attachment = self.repository.get_by_id(attachment_id)

        if (
            attachment is None
            or attachment.incident_id != incident_id
        ):
            raise AttachmentNotFoundError(
                "El adjunto no está disponible."
            )

        try:
            path = self.storage.get_path(attachment.storage_key)
        except FileNotFoundError as error:
            raise AttachmentNotFoundError(
                "El adjunto no está disponible."
            ) from error

        return AttachmentDownload(
            path=path,
            filename=attachment.original_filename,
            content_type=attachment.content_type,
        )

    def _get_accessible_incident(
        self,
        *,
        incident_id: int,
        current_user: User,
    ) -> Incident:
        incident = self.incident_repository.get_by_id(incident_id)

        if (
            incident is None
            or not current_user.is_active
            or not self._can_access(incident, current_user)
        ):
            raise AttachmentNotFoundError(
                "La incidencia no está disponible."
            )

        return incident

    @staticmethod
    def _can_access(
        incident: Incident,
        current_user: User,
    ) -> bool:
        return (
            incident.reporter_id == current_user.id
            or current_user.role == UserRole.IT_MANAGER
            or (
                current_user.role == UserRole.TECHNICIAN
                and incident.assigned_to_id == current_user.id
            )
        )

    @staticmethod
    def _validate_pagination(offset: int, limit: int) -> None:
        if offset < 0:
            raise ValueError(
                "El desplazamiento no puede ser negativo."
            )

        if not 1 <= limit <= 100:
            raise ValueError(
                "El límite debe estar entre 1 y 100."
            )