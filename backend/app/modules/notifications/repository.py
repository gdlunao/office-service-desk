from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.notifications.models import Notification


class NotificationRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def add(
        self,
        notification: Notification,
    ) -> Notification:
        self.session.add(notification)
        self.session.flush()

        return notification

    def list_for_recipient(
        self,
        *,
        recipient_id: int,
        unread_only: bool = False,
        offset: int = 0,
        limit: int = 20,
    ) -> list[Notification]:
        if offset < 0:
            raise ValueError(
                "El desplazamiento no puede ser negativo."
            )

        if not 1 <= limit <= 100:
            raise ValueError(
                "El límite debe estar entre 1 y 100."
            )

        statement = select(Notification).where(
            Notification.recipient_id == recipient_id
        )

        if unread_only:
            statement = statement.where(
                Notification.read_at.is_(None)
            )

        statement = (
            statement
            .order_by(
                Notification.created_at.desc(),
                Notification.id.desc(),
            )
            .offset(offset)
            .limit(limit)
        )

        return list(
            self.session.scalars(statement).all()
        )

    def count_unread(
        self,
        *,
        recipient_id: int,
    ) -> int:
        statement = (
            select(func.count(Notification.id))
            .where(
                Notification.recipient_id == recipient_id,
                Notification.read_at.is_(None),
            )
        )

        return int(
            self.session.scalar(statement) or 0
        )

    def get_for_recipient_for_update(
        self,
        *,
        notification_id: int,
        recipient_id: int,
    ) -> Notification | None:
        statement = (
            select(Notification)
            .where(
                Notification.id == notification_id,
                Notification.recipient_id == recipient_id,
            )
            .with_for_update()
            .execution_options(populate_existing=True)
        )

        return self.session.scalar(statement)