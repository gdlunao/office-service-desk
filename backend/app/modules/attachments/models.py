from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base


def utc_now() -> datetime:
    """Devuelve UTC para columnas MySQL sin zona horaria."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class IncidentAttachment(Base):
    __tablename__ = "incident_attachments"

    __table_args__ = (
        CheckConstraint(
            "file_size_bytes > 0",
            name="ck_incident_attachments_positive_size",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    incident_id: Mapped[int] = mapped_column(
        ForeignKey(
            "incidents.id",
            name="fk_incident_attachments_incident_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    uploaded_by_id: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id",
            name="fk_incident_attachments_uploaded_by_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )

    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    storage_key: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
    )

    content_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    file_size_bytes: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )

    sha256: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
    )