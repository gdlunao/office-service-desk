from collections.abc import Iterator, Mapping
from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased

from app.modules.incidents.models import (
    Incident,
    IncidentSolutionAttempt,
    IncidentStatus,
)


class ReportRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def iter_resolved_incidents(
        self,
        *,
        recovered_from: datetime | None = None,
        recovered_before: datetime | None = None,
    ) -> Iterator[Mapping[str, Any]]:
        if (
            recovered_from is not None
            and recovered_before is not None
            and recovered_from >= recovered_before
        ):
            raise ValueError(
                "El inicio del período debe ser anterior al final."
            )

        attempt_summary = (
            select(
                IncidentSolutionAttempt.incident_id.label(
                    "incident_id"
                ),
                func.count(
                    IncidentSolutionAttempt.id
                ).label("attempt_count"),
                func.max(
                    IncidentSolutionAttempt.attempt_number
                ).label("latest_attempt_number"),
            )
            .group_by(
                IncidentSolutionAttempt.incident_id
            )
            .subquery()
        )

        first_attempt = aliased(IncidentSolutionAttempt)
        latest_attempt = aliased(IncidentSolutionAttempt)

        statement = (
            select(
                Incident.id.label("incident_id"),
                Incident.status.label("incident_status"),
                Incident.started_at.label(
                    "attention_started_at"
                ),
                Incident.resolved_at.label("resolved_at"),
                func.coalesce(
                    attempt_summary.c.attempt_count,
                    0,
                ).label("attempt_count"),
                first_attempt.started_at.label(
                    "first_attempt_started_at"
                ),
                first_attempt.finished_at.label(
                    "first_attempt_finished_at"
                ),
                first_attempt.status.label(
                    "first_attempt_status"
                ),
                latest_attempt.attempt_number.label(
                    "latest_attempt_number"
                ),
                latest_attempt.status.label(
                    "latest_attempt_status"
                ),
                latest_attempt.finished_at.label(
                    "latest_attempt_finished_at"
                ),
                latest_attempt.returned_at.label(
                    "latest_attempt_returned_at"
                ),
                latest_attempt.solution_description.label(
                    "latest_solution_description"
                ),
                latest_attempt.technical_actions.label(
                    "latest_technical_actions"
                ),
                latest_attempt.recovery_evidence.label(
                    "latest_recovery_evidence"
                ),
            )
            .outerjoin(
                attempt_summary,
                attempt_summary.c.incident_id == Incident.id,
            )
            .outerjoin(
                first_attempt,
                (
                    first_attempt.incident_id == Incident.id
                )
                & (
                    first_attempt.attempt_number == 1
                ),
            )
            .outerjoin(
                latest_attempt,
                (
                    latest_attempt.incident_id == Incident.id
                )
                & (
                    latest_attempt.attempt_number
                    == attempt_summary.c.latest_attempt_number
                ),
            )
            .where(
                Incident.status.in_(
                    (
                        IncidentStatus.PENDING_CONFIRMATION,
                        IncidentStatus.CLOSED,
                    )
                )
            )
            .order_by(Incident.id)
        )

        # Los límites se reciben como fechas UTC sin zona horaria,
        # igual que las columnas DateTime del sistema.
        if recovered_from is not None:
            statement = statement.where(
                Incident.resolved_at >= recovered_from
            )

        if recovered_before is not None:
            statement = statement.where(
                Incident.resolved_at < recovered_before
            )

        result = self.session.execute(
            statement.execution_options(yield_per=200)
        )

        try:
            yield from result.mappings()
        finally:
            result.close()