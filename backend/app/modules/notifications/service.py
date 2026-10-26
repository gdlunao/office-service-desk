from app.modules.incidents.models import utc_now
from app.modules.notifications.repository import (
    NotificationRepository,
)
from app.modules.notifications.schemas import (
    NotificationResponse,
    NotificationUnreadCountResponse,
)
from app.modules.users.models import User


class NotificationNotFoundError(Exception):
    pass


class NotificationService:
    def __init__(
        self,
        repository: NotificationRepository,
    ) -> None:
        self.repository = repository

    def list_my_notifications(
        self,
        *,
        current_user: User,
        unread_only: bool = False,
        offset: int = 0,
        limit: int = 20,
    ) -> list[NotificationResponse]:
        notifications = self.repository.list_for_recipient(
            recipient_id=current_user.id,
            unread_only=unread_only,
            offset=offset,
            limit=limit,
        )

        return [
            NotificationResponse.model_validate(notification)
            for notification in notifications
        ]

    def count_my_unread(
        self,
        *,
        current_user: User,
    ) -> NotificationUnreadCountResponse:
        count = self.repository.count_unread(
            recipient_id=current_user.id,
        )

        return NotificationUnreadCountResponse(
            unread_count=count,
        )

    def mark_as_read(
        self,
        *,
        notification_id: int,
        current_user: User,
    ) -> NotificationResponse:
        session = self.repository.session

        try:
            notification = (
                self.repository.get_for_recipient_for_update(
                    notification_id=notification_id,
                    recipient_id=current_user.id,
                )
            )

            if notification is None:
                raise NotificationNotFoundError(
                    "La notificación no está disponible."
                )

            if notification.read_at is None:
                notification.read_at = utc_now()

            session.flush()

            response = NotificationResponse.model_validate(
                notification
            )

            session.commit()

            return response

        except Exception:
            session.rollback()
            raise