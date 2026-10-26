from app.modules.incidents.attempt_repository import (
    SolutionAttemptRepository,
)
from app.modules.incidents.attempt_schemas import (
    SolutionAttemptFinish,
    SolutionAttemptResponse,
    SolutionAttemptStart,
)
from app.modules.incidents.models import (
    IncidentEvent,
    IncidentEventType,
    IncidentSolutionAttempt,
    IncidentStatus,
    SolutionAttemptStatus,
    utc_now,
)
from app.modules.incidents.repository import IncidentRepository
from app.modules.users.enums import UserRole
from app.modules.users.models import User

from app.modules.notifications.models import (
    Notification,
    NotificationType,
)
from app.modules.notifications.repository import NotificationRepository

class SolutionAttemptNotFoundError(Exception):
    pass


class SolutionAttemptPermissionError(Exception):
    pass


class SolutionAttemptConflictError(Exception):
    pass


class SolutionAttemptService:
    def __init__(
        self,
        incident_repository: IncidentRepository,
    ) -> None:
        self.incident_repository = incident_repository

        self.attempt_repository = SolutionAttemptRepository(
            incident_repository.session
        )

        self.notification_repository = NotificationRepository(
            incident_repository.session
        )

    def start_attempt(
        self,
        *,
        incident_id: int,
        current_user: User,
        data: SolutionAttemptStart,
    ) -> SolutionAttemptResponse:
        session = self.incident_repository.session

        try:
            if (
                not current_user.is_active
                or current_user.role != UserRole.TECHNICIAN
            ):
                raise SolutionAttemptPermissionError(
                    "Se requiere una cuenta activa con rol de técnico."
                )

            # Bloqueamos primero la incidencia para impedir que dos
            # solicitudes creen intentos simultáneos para el mismo caso.
            incident = (
                self.incident_repository.get_by_id_for_update(
                    incident_id
                )
            )

            if (
                incident is None
                or incident.assigned_to_id != current_user.id
            ):
                raise SolutionAttemptNotFoundError(
                    "La incidencia no está disponible para tu cuenta."
                )

            if (
                incident.status != IncidentStatus.IN_PROGRESS
                or incident.started_at is None
                or incident.resolved_at is not None
                or incident.resolution_summary is not None
                or incident.closed_at is not None
            ):
                raise SolutionAttemptConflictError(
                    "Solo puedes iniciar un intento en una incidencia "
                    "que esté en atención y pendiente de recuperación."
                )

            latest_attempt = (
                self.attempt_repository.get_latest_for_update(
                    incident_id
                )
            )

            if latest_attempt is not None:
                if latest_attempt.status not in (
                    SolutionAttemptStatus.FAILED,
                    SolutionAttemptStatus.RETURNED,
                ):
                    raise SolutionAttemptConflictError(
                        "El intento anterior sigue en curso o está "
                        "pendiente de confirmación del reportante."
                    )

                attempt_number = latest_attempt.attempt_number + 1
            else:
                attempt_number = 1

            attempt = IncidentSolutionAttempt(
                incident_id=incident.id,
                technician_id=current_user.id,
                attempt_number=attempt_number,
                status=SolutionAttemptStatus.IN_PROGRESS,
                solution_description=data.solution_description,
                started_at=utc_now(),
            )

            self.attempt_repository.add(attempt)

            # Recargamos los campos calculados, como technician_name.
            session.refresh(attempt)

            response = SolutionAttemptResponse.model_validate(
                attempt
            )

            session.commit()

            return response

        except Exception:
            session.rollback()
            raise

    def finish_attempt(
        self,
        *,
        incident_id: int,
        attempt_id: int,
        current_user: User,
        data: SolutionAttemptFinish,
    ) -> SolutionAttemptResponse:
        session = self.incident_repository.session

        try:
            if (
                not current_user.is_active
                or current_user.role != UserRole.TECHNICIAN
            ):
                raise SolutionAttemptPermissionError(
                    "Se requiere una cuenta activa con rol de técnico."
                )

            incident = (
                self.incident_repository.get_by_id_for_update(
                    incident_id
                )
            )

            if (
                incident is None
                or incident.assigned_to_id != current_user.id
            ):
                raise SolutionAttemptNotFoundError(
                    "La incidencia no está disponible para tu cuenta."
                )

            if (
                incident.status != IncidentStatus.IN_PROGRESS
                or incident.started_at is None
                or incident.resolved_at is not None
                or incident.resolution_summary is not None
                or incident.closed_at is not None
            ):
                raise SolutionAttemptConflictError(
                    "La incidencia debe estar en atención "
                    "y pendiente de recuperación."
                )

            attempt = (
                self.attempt_repository.get_by_id_for_update(
                    incident_id=incident_id,
                    attempt_id=attempt_id,
                )
            )

            if (
                attempt is None
                or attempt.technician_id != current_user.id
            ):
                raise SolutionAttemptNotFoundError(
                    "El intento no está disponible para tu cuenta."
                )

            latest_attempt = (
                self.attempt_repository.get_latest_for_update(
                    incident_id
                )
            )

            if (
                latest_attempt is None
                or latest_attempt.id != attempt.id
                or attempt.status
                != SolutionAttemptStatus.IN_PROGRESS
                or attempt.finished_at is not None
                or attempt.returned_at is not None
            ):
                raise SolutionAttemptConflictError(
                    "Solo puedes finalizar el último intento "
                    "que siga en curso."
                )

            finished_at = utc_now()

            if finished_at < attempt.started_at:
                raise SolutionAttemptConflictError(
                    "La fecha de finalización es anterior al inicio. "
                    "Revisa la hora del servidor."
                )

            attempt.status = SolutionAttemptStatus(data.status)
            attempt.solution_description = (
                data.solution_description
            )
            attempt.technical_actions = data.technical_actions
            attempt.recovery_evidence = data.recovery_evidence
            attempt.finished_at = finished_at

            if (
                attempt.status
                == SolutionAttemptStatus.RECOVERED
            ):
                incident.resolution_summary = (
                    data.solution_description
                )
                incident.resolved_at = finished_at
                incident.status = (
                    IncidentStatus.PENDING_CONFIRMATION
                )

                event = IncidentEvent(
                    incident_id=incident.id,
                    actor_id=current_user.id,
                    event_type=IncidentEventType.RESOLVED,
                    previous_status=IncidentStatus.IN_PROGRESS,
                    new_status=(
                        IncidentStatus.PENDING_CONFIRMATION
                    ),
                    details=(
                        f"Recuperación registrada en el intento "
                        f"{attempt.attempt_number}.\n\n"
                        f"Solución aplicada:\n"
                        f"{data.solution_description}\n\n"
                        f"Acciones técnicas:\n"
                        f"{data.technical_actions}\n\n"
                        f"Evidencia de recuperación:\n"
                        f"{data.recovery_evidence}"
                    ),
                    created_at=finished_at,
                )

                self.incident_repository.add_event(event)
                notification = Notification(
                    recipient_id=incident.reporter_id,
                    incident_id=incident.id,
                    source_event_id=event.id,
                    notification_type=(
                        NotificationType.INCIDENT_RESOLVED
                    ),
                    title="Solución pendiente de confirmación",
                    message=(
                        f"Se registró una solución para la incidencia "
                        f"#{incident.id}: {incident.title}. "
                        "Revisa el detalle y confirma si el servicio "
                        "funciona correctamente o devuelve la solución "
                        "indicando el motivo."
                    ),
                    created_at=finished_at,
                    read_at=None,
                )

                self.notification_repository.add(notification)
            session.flush()
            session.refresh(attempt)

            response = SolutionAttemptResponse.model_validate(
                attempt
            )

            session.commit()

            return response

        except Exception:
            session.rollback()
            raise

    def list_attempts(
        self,
        *,
        incident_id: int,
        current_user: User,
        offset: int = 0,
        limit: int = 20,
    ) -> list[SolutionAttemptResponse]:
        if not current_user.is_active:
            raise SolutionAttemptPermissionError(
                "La cuenta debe estar activa."
            )

        if offset < 0:
            raise ValueError(
                "El desplazamiento no puede ser negativo."
            )

        if not 1 <= limit <= 100:
            raise ValueError(
                "El límite debe estar entre 1 y 100."
            )

        incident = self.incident_repository.get_by_id(
            incident_id
        )

        if incident is None:
            raise SolutionAttemptNotFoundError(
                "La incidencia no está disponible."
            )

        is_reporter = (
            incident.reporter_id == current_user.id
        )

        is_assigned_technician = (
            current_user.role == UserRole.TECHNICIAN
            and incident.assigned_to_id == current_user.id
        )

        is_it_manager = (
            current_user.role == UserRole.IT_MANAGER
        )

        if not (
            is_reporter
            or is_assigned_technician
            or is_it_manager
        ):
            raise SolutionAttemptNotFoundError(
                "La incidencia no está disponible."
            )

        attempts = self.attempt_repository.list_by_incident(
            incident_id=incident_id,
            offset=offset,
            limit=limit,
        )

        return [
            SolutionAttemptResponse.model_validate(attempt)
            for attempt in attempts
        ]

    def get_latest_attempt(
        self,
        *,
        incident_id: int,
        current_user: User,
    ) -> SolutionAttemptResponse | None:
        # Reutilizamos las comprobaciones de acceso del listado.
        self.list_attempts(
            incident_id=incident_id,
            current_user=current_user,
            offset=0,
            limit=1,
        )

        attempt = self.attempt_repository.get_latest(
            incident_id
        )

        if attempt is None:
            return None

        return SolutionAttemptResponse.model_validate(attempt)