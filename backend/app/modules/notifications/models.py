from datetime import datetime
from enum import Enum

from sqlalchemy import (
    DateTime,
    Enum as SQLAlchemyEnum,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base
from app.modules.incidents.models import utc_now


class NotificationType(str, Enum):
    INCIDENT_ASSIGNED = "incident_assigned"
    INCIDENT_RESOLVED = "incident_resolved"


class Notification(Base):
    __tablename__ = "notifications"

    __table_args__ = (
        UniqueConstraint(
            "source_event_id",
            "recipient_id",
            name="uq_notifications_event_recipient",
        ),
        Index(
            "ix_notifications_recipient_created",
            "recipient_id",
            "created_at",
            "id",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    recipient_id: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id",
            name="fk_notifications_recipient",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )

    incident_id: Mapped[int] = mapped_column(
        ForeignKey(
            "incidents.id",
            name="fk_notifications_incident",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    source_event_id: Mapped[int] = mapped_column(
        ForeignKey(
            "incident_events.id",
            name="fk_notifications_source_event",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )

    notification_type: Mapped[NotificationType] = mapped_column(
        SQLAlchemyEnum(
            NotificationType,
            name="notification_type",
            native_enum=False,
            create_constraint=True,
            values_callable=lambda enum_type: [
                item.value
                for item in enum_type
            ],
            validate_strings=True,
            length=30,
        ),
        nullable=False,
    )

    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    message: Mapped[str] = mapped_column(
        String(1_000),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
    )

    read_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )