from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Path,
    Query,
    status,
)
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.notifications.repository import (
    NotificationRepository,
)
from app.modules.notifications.schemas import (
    NotificationResponse,
    NotificationUnreadCountResponse,
)
from app.modules.notifications.service import (
    NotificationNotFoundError,
    NotificationService,
)
from app.modules.users.models import User


router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
)


def get_notification_service(
    session: Annotated[Session, Depends(get_db)],
) -> NotificationService:
    return NotificationService(
        NotificationRepository(session)
    )


@router.get(
    "",
    response_model=list[NotificationResponse],
)
def list_my_notifications(
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[
        NotificationService,
        Depends(get_notification_service),
    ],
    unread_only: bool = False,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[NotificationResponse]:
    return service.list_my_notifications(
        current_user=current_user,
        unread_only=unread_only,
        offset=offset,
        limit=limit,
    )


@router.get(
    "/unread-count",
    response_model=NotificationUnreadCountResponse,
)
def count_my_unread_notifications(
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[
        NotificationService,
        Depends(get_notification_service),
    ],
) -> NotificationUnreadCountResponse:
    return service.count_my_unread(
        current_user=current_user,
    )


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
)
def mark_notification_as_read(
    notification_id: Annotated[int, Path(ge=1)],
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[
        NotificationService,
        Depends(get_notification_service),
    ],
) -> NotificationResponse:
    try:
        return service.mark_as_read(
            notification_id=notification_id,
            current_user=current_user,
        )
    except NotificationNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error