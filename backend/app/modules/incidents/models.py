from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum as SQLAlchemyEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    select,
)

from app.modules.incidents.classification import (
    IncidentCategory,
    IncidentImpact,
    IncidentPriority,
    IncidentUrgency,
)

from sqlalchemy.orm import Mapped, column_property, mapped_column

from app.core.base import Base
from app.modules.users.models import User

def utc_now() -> datetime:
    """Devuelve la fecha UTC para columnas MySQL sin zona horaria."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class IncidentStatus(str, Enum):
    REPORTED = "reported"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    PENDING_CONFIRMATION = "pending_confirmation"
    CLOSED = "closed"


class Incident(Base):
    __tablename__ = "incidents"
    __table_args__ = (
        CheckConstraint(
            "("
            "category IS NULL AND "
            "impact IS NULL AND "
            "urgency IS NULL AND "
            "priority IS NULL AND "
            "classified_by_id IS NULL AND "
            "classified_at IS NULL"
            ") OR ("
            "category IS NOT NULL AND "
            "impact IS NOT NULL AND "
            "urgency IS NOT NULL AND "
            "priority IS NOT NULL AND "
            "classified_by_id IS NOT NULL AND "
            "classified_at IS NOT NULL"
            ")",
            name="ck_incidents_complete_classification",
        ),
    )
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    reporter_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    status: Mapped[IncidentStatus] = mapped_column(
        SQLAlchemyEnum(
            IncidentStatus,
            name="incident_status",
            native_enum=False,
            create_constraint=True,
            values_callable=lambda enum_type: [
                item.value for item in enum_type
            ],
            validate_strings=True,
            length=30,
        ),
        nullable=False,
        default=IncidentStatus.REPORTED,
        server_default=IncidentStatus.REPORTED.value,
        index=True,
    )

    category: Mapped[IncidentCategory | None] = mapped_column(
        SQLAlchemyEnum(
            IncidentCategory,
            name="incident_category",
            native_enum=False,
            create_constraint=True,
            values_callable=lambda enum_type: [
                item.value for item in enum_type
            ],
            validate_strings=True,
            length=2,
        ),
        nullable=True,
        index=True,
    )

    impact: Mapped[IncidentImpact | None] = mapped_column(
        SQLAlchemyEnum(
            IncidentImpact,
            name="incident_impact",
            native_enum=False,
            create_constraint=True,
            values_callable=lambda enum_type: [
                item.value for item in enum_type
            ],
            validate_strings=True,
            length=10,
        ),
        nullable=True,
    )

    urgency: Mapped[IncidentUrgency | None] = mapped_column(
        SQLAlchemyEnum(
            IncidentUrgency,
            name="incident_urgency",
            native_enum=False,
            create_constraint=True,
            values_callable=lambda enum_type: [
                item.value for item in enum_type
            ],
            validate_strings=True,
            length=10,
        ),
        nullable=True,
    )

    priority: Mapped[IncidentPriority | None] = mapped_column(
        SQLAlchemyEnum(
            IncidentPriority,
            name="incident_priority",
            native_enum=False,
            create_constraint=True,
            values_callable=lambda enum_type: [
                item.value for item in enum_type
            ],
            validate_strings=True,
            length=2,
        ),
        nullable=True,
        index=True,
    )

    classified_by_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "users.id",
            name="fk_incidents_classified_by_id_users",
            ondelete="RESTRICT",
        ),
        nullable=True,
    )

    classified_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )
    assigned_to_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "users.id",
            name="fk_incidents_assigned_to_id_users",
            ondelete="RESTRICT",
        ),
        nullable=True,
        index=True,
    )

    assigned_by_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "users.id",
            name="fk_incidents_assigned_by_id_users",
            ondelete="RESTRICT",
        ),
        nullable=True,
    )

    assigned_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    started_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    resolution_summary: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
    )

    reporter_name: Mapped[str] = column_property(
        select(User.full_name)
        .where(User.id == reporter_id)
        .correlate_except(User)
        .scalar_subquery()
    )

    assigned_to_name: Mapped[str | None] = column_property(
        select(User.full_name)
        .where(User.id == assigned_to_id)
        .correlate_except(User)
        .scalar_subquery()
    )

    assigned_by_name: Mapped[str | None] = column_property(
        select(User.full_name)
        .where(User.id == assigned_by_id)
        .correlate_except(User)
        .scalar_subquery()
    )

class IncidentEventType(str, Enum):
    REPORTED = "reported"
    ASSIGNED = "assigned"
    STARTED = "started"
    RESOLVED = "resolved"
    CLOSED = "closed"
    RETURNED = "returned"
    CLASSIFIED = "classified"


class IncidentEvent(Base):
    __tablename__ = "incident_events"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    incident_id: Mapped[int] = mapped_column(
        ForeignKey(
            "incidents.id",
            name="fk_incident_events_incident_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    actor_id: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id",
            name="fk_incident_events_actor_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )

    event_type: Mapped[IncidentEventType] = mapped_column(
        SQLAlchemyEnum(
            IncidentEventType,
            name="incident_event_type",
            native_enum=False,
            create_constraint=True,
            values_callable=lambda enum_type: [
                item.value for item in enum_type
            ],
            validate_strings=True,
            length=30,
        ),
        nullable=False,
    )

    previous_status: Mapped[IncidentStatus | None] = mapped_column(
        SQLAlchemyEnum(
            IncidentStatus,
            name="incident_event_previous_status",
            native_enum=False,
            create_constraint=True,
            values_callable=lambda enum_type: [
                item.value for item in enum_type
            ],
            validate_strings=True,
            length=30,
        ),
        nullable=True,
    )

    new_status: Mapped[IncidentStatus] = mapped_column(
        SQLAlchemyEnum(
            IncidentStatus,
            name="incident_event_new_status",
            native_enum=False,
            create_constraint=True,
            values_callable=lambda enum_type: [
                item.value for item in enum_type
            ],
            validate_strings=True,
            length=30,
        ),
        nullable=False,
    )

    details: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
    )

    actor_name: Mapped[str] = column_property(
        select(User.full_name)
        .where(User.id == actor_id)
        .correlate_except(User)
        .scalar_subquery()
    )

class SolutionAttemptStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    FAILED = "failed"
    RECOVERED = "recovered"
    RETURNED = "returned"


class IncidentSolutionAttempt(Base):
    __tablename__ = "incident_solution_attempts"

    __table_args__ = (
        UniqueConstraint(
            "incident_id",
            "attempt_number",
            name="uq_solution_attempt_incident_number",
        ),
        CheckConstraint(
            "attempt_number >= 1",
            name="ck_solution_attempt_positive_number",
        ),
        CheckConstraint(
            "finished_at IS NULL OR finished_at >= started_at",
            name="ck_solution_attempt_valid_dates",
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
            name="fk_solution_attempt_incident_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    technician_id: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id",
            name="fk_solution_attempt_technician_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )

    attempt_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    status: Mapped[SolutionAttemptStatus] = mapped_column(
        SQLAlchemyEnum(
            SolutionAttemptStatus,
            name="solution_attempt_status",
            native_enum=False,
            create_constraint=True,
            values_callable=lambda enum_type: [
                item.value for item in enum_type
            ],
            validate_strings=True,
            length=20,
        ),
        nullable=False,
        default=SolutionAttemptStatus.IN_PROGRESS,
        server_default=SolutionAttemptStatus.IN_PROGRESS.value,
    )

    solution_description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    technical_actions: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    recovery_evidence: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    started_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
    )

    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    returned_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    return_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    technician_name: Mapped[str] = column_property(
        select(User.full_name)
        .where(User.id == technician_id)
        .correlate_except(User)
        .scalar_subquery()
    )