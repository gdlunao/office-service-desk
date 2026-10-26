from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.attachments.models import IncidentAttachment


class AttachmentRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def add(
        self,
        attachment: IncidentAttachment,
    ) -> IncidentAttachment:
        self.session.add(attachment)
        self.session.flush()
        return attachment

    def get_by_id(
        self,
        attachment_id: int,
    ) -> IncidentAttachment | None:
        statement = select(IncidentAttachment).where(
            IncidentAttachment.id == attachment_id,
        )

        return self.session.scalar(statement)

    def list_by_incident(
        self,
        incident_id: int,
        *,
        offset: int = 0,
        limit: int = 20,
    ) -> list[IncidentAttachment]:
        statement = (
            select(IncidentAttachment)
            .where(
                IncidentAttachment.incident_id == incident_id,
            )
            .order_by(
                IncidentAttachment.created_at.asc(),
                IncidentAttachment.id.asc(),
            )
            .offset(offset)
            .limit(limit)
        )

        return list(self.session.scalars(statement).all())

    def count_by_incident(self, incident_id: int) -> int:
        statement = (
            select(func.count())
            .select_from(IncidentAttachment)
            .where(
                IncidentAttachment.incident_id == incident_id,
            )
        )

        return self.session.execute(statement).scalar_one()
        
    def count_by_incident_for_update(
        self,
        incident_id: int,
    ) -> int:
        statement = (
            select(IncidentAttachment.id)
            .where(
                IncidentAttachment.incident_id == incident_id,
            )
            .with_for_update()
        )

        return len(self.session.scalars(statement).all())