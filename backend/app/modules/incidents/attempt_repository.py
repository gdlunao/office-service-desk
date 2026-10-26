from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.incidents.models import IncidentSolutionAttempt


class SolutionAttemptRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def add(
        self,
        attempt: IncidentSolutionAttempt,
    ) -> IncidentSolutionAttempt:
        self.session.add(attempt)
        self.session.flush()
        return attempt

    def get_by_id_for_update(
        self,
        *,
        incident_id: int,
        attempt_id: int,
    ) -> IncidentSolutionAttempt | None:
        statement = (
            select(IncidentSolutionAttempt)
            .where(
                IncidentSolutionAttempt.incident_id == incident_id,
                IncidentSolutionAttempt.id == attempt_id,
            )
            .with_for_update()
            .execution_options(populate_existing=True)
        )

        return self.session.scalar(statement)

    def get_latest_for_update(
        self,
        incident_id: int,
    ) -> IncidentSolutionAttempt | None:
        statement = (
            select(IncidentSolutionAttempt)
            .where(
                IncidentSolutionAttempt.incident_id == incident_id,
            )
            .order_by(
                IncidentSolutionAttempt.attempt_number.desc(),
            )
            .limit(1)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

        return self.session.scalar(statement)

    def list_by_incident(
        self,
        *,
        incident_id: int,
        offset: int = 0,
        limit: int = 20,
    ) -> list[IncidentSolutionAttempt]:
        statement = (
            select(IncidentSolutionAttempt)
            .where(
                IncidentSolutionAttempt.incident_id == incident_id,
            )
            .order_by(
                IncidentSolutionAttempt.attempt_number.asc(),
            )
            .offset(offset)
            .limit(limit)
        )

        return list(self.session.scalars(statement).all())

    def get_latest(
        self,
        incident_id: int,
    ) -> IncidentSolutionAttempt | None:
        statement = (
            select(IncidentSolutionAttempt)
            .where(
                IncidentSolutionAttempt.incident_id
                == incident_id
            )
            .order_by(
                IncidentSolutionAttempt.attempt_number.desc()
            )
            .limit(1)
        )

        return self.session.scalar(statement)