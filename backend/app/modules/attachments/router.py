from typing import Annotated, NoReturn

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Path,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.modules.attachments.repository import AttachmentRepository
from app.modules.attachments.schemas import AttachmentResponse
from app.modules.attachments.service import (
    AttachmentLimitReachedError,
    AttachmentNotFoundError,
    AttachmentService,
    AttachmentUploadConflictError,
)
from app.modules.attachments.storage import LocalAttachmentStorage
from app.modules.attachments.validators import InvalidAttachmentError
from app.modules.auth.dependencies import get_current_user
from app.modules.incidents.repository import IncidentRepository
from app.modules.users.models import User


router = APIRouter(
    prefix="/incidents/{incident_id}/attachments",
    tags=["Attachments"],
)


def get_attachment_service(
    session: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AttachmentService:
    return AttachmentService(
        repository=AttachmentRepository(session),
        incident_repository=IncidentRepository(session),
        storage=LocalAttachmentStorage(
            settings.attachments_storage_dir
        ),
    )


def raise_attachment_http_error(error: Exception) -> NoReturn:
    if isinstance(error, AttachmentNotFoundError):
        status_code = status.HTTP_404_NOT_FOUND
    elif isinstance(error, InvalidAttachmentError):
        status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    else:
        status_code = status.HTTP_409_CONFLICT

    raise HTTPException(
        status_code=status_code,
        detail=str(error),
    ) from error


@router.post(
    "",
    response_model=AttachmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_attachment(
    incident_id: Annotated[int, Path(ge=1)],
    file: Annotated[UploadFile, File()],
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[
        AttachmentService,
        Depends(get_attachment_service),
    ],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AttachmentResponse:
    try:
        content = file.file.read(
            settings.attachments_max_file_size_bytes + 1
        )

        return service.upload_attachment(
            incident_id=incident_id,
            current_user=current_user,
            filename=file.filename or "",
            content=content,
            max_files_per_incident=(
                settings.attachments_max_files_per_incident
            ),
            max_file_size_bytes=(
                settings.attachments_max_file_size_bytes
            ),
        )

    except (
        AttachmentNotFoundError,
        InvalidAttachmentError,
        AttachmentLimitReachedError,
        AttachmentUploadConflictError,
    ) as error:
        raise_attachment_http_error(error)

    finally:
        file.file.close()


@router.get(
    "",
    response_model=list[AttachmentResponse],
)
def list_attachments(
    incident_id: Annotated[int, Path(ge=1)],
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[
        AttachmentService,
        Depends(get_attachment_service),
    ],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[AttachmentResponse]:
    try:
        return service.list_attachments(
            incident_id=incident_id,
            current_user=current_user,
            offset=offset,
            limit=limit,
        )
    except AttachmentNotFoundError as error:
        raise_attachment_http_error(error)


@router.get("/{attachment_id}/download")
def download_attachment(
    incident_id: Annotated[int, Path(ge=1)],
    attachment_id: Annotated[int, Path(ge=1)],
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[
        AttachmentService,
        Depends(get_attachment_service),
    ],
) -> FileResponse:
    try:
        download = service.get_download(
            incident_id=incident_id,
            attachment_id=attachment_id,
            current_user=current_user,
        )
    except AttachmentNotFoundError as error:
        raise_attachment_http_error(error)

    return FileResponse(
        path=download.path,
        filename=download.filename,
        media_type=download.content_type,
        content_disposition_type="attachment",
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )