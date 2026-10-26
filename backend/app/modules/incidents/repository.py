from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.incidents.models import Incident, IncidentEvent


class IncidentRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def add(self, incident: Incident) -> Incident:
        self.session.add(incident)
        self.session.flush()
        return incident

    def get_by_id(self, incident_id: int) -> Incident | None:
        statement = select(Incident).where(
            Incident.id == incident_id,
        )

        return self.session.scalar(statement)

    def get_by_id_for_update(
        self,
        incident_id: int,
    ) -> Incident | None:
        statement = (
            select(Incident)
            .where(Incident.id == incident_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

        return self.session.scalar(statement)

    def list_all(
        self,
        offset: int = 0,
        limit: int = 20,
    ) -> list[Incident]:
        statement = (
            select(Incident)
            .order_by(
                Incident.created_at.desc(),
                Incident.id.desc(),
            )
            .offset(offset)
            .limit(limit)
        )

        return list(self.session.scalars(statement).all())
        

    def list_by_assignee(
        self,
        assignee_id: int,
        offset: int = 0,
        limit: int = 20,
    ) -> list[Incident]:
        statement = (
            select(Incident)
            .where(Incident.assigned_to_id == assignee_id)
            .order_by(
                Incident.created_at.desc(),
                Incident.id.desc(),
            )
            .offset(offset)
            .limit(limit)
        )

        return list(self.session.scalars(statement).all())


    def list_by_reporter(
        self,
        reporter_id: int,
        offset: int = 0,
        limit: int = 20,
    ) -> list[Incident]:
        statement = (
            select(Incident)
            .where(Incident.reporter_id == reporter_id)
            .order_by(
                Incident.created_at.desc(),
                Incident.id.desc(),
            )
            .offset(offset)
            .limit(limit)
        )

        return list(self.session.scalars(statement).all())


    def add_event(self, event: IncidentEvent) -> IncidentEvent:
        self.session.add(event)
        self.session.flush()
        return event

    def list_events(
        self,
        incident_id: int,
        *,
        offset: int = 0,
        limit: int = 20,
    ) -> list[IncidentEvent]:
        statement = (
            select(IncidentEvent)
            .where(IncidentEvent.incident_id == incident_id)
            .order_by(
                IncidentEvent.created_at.asc(),
                IncidentEvent.id.asc(),
            )
            .offset(offset)
            .limit(limit)
        )

        return list(self.session.scalars(statement).all())