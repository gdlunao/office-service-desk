from app.modules.incidents.ai_client import (
    GeminiClassificationClient,
)
from app.modules.incidents.ai_schemas import (
    IncidentClassificationSuggestionResponse,
)
from app.modules.incidents.classification import calculate_priority
from app.modules.incidents.models import IncidentStatus
from app.modules.incidents.repository import IncidentRepository
from app.modules.incidents.service import IncidentNotFoundError
from app.modules.users.enums import UserRole
from app.modules.users.models import User


class IncidentAISuggestionPermissionError(Exception):
    pass


class IncidentAISuggestionConflictError(Exception):
    pass


class IncidentAIService:
    def __init__(
        self,
        repository: IncidentRepository,
        client: GeminiClassificationClient,
    ) -> None:
        self.repository = repository
        self.client = client

    def suggest_classification(
        self,
        *,
        incident_id: int,
        current_user: User,
    ) -> IncidentClassificationSuggestionResponse:
        if (
            not current_user.is_active
            or current_user.role != UserRole.IT_MANAGER
        ):
            raise IncidentAISuggestionPermissionError(
                "Solo el responsable TI puede solicitar "
                "sugerencias de clasificación."
            )

        incident = self.repository.get_by_id(incident_id)

        if incident is None:
            raise IncidentNotFoundError(
                "La incidencia no está disponible."
            )

        if (
            incident.status not in (
                IncidentStatus.REPORTED,
                IncidentStatus.ASSIGNED,
                IncidentStatus.IN_PROGRESS,
            )
            or incident.resolved_at is not None
            or incident.closed_at is not None
        ):
            raise IncidentAISuggestionConflictError(
                "Solo se pueden solicitar sugerencias para "
                "incidencias reportadas, asignadas o en atención."
            )

        suggestion = self.client.suggest_classification(
            title=incident.title,
            description=incident.description,
        )

        priority = calculate_priority(
            suggestion.impact,
            suggestion.urgency,
        )

        return IncidentClassificationSuggestionResponse(
            **suggestion.model_dump(),
            incident_id=incident.id,
            priority=priority,
            model=self.client.settings.gemini_model.strip(),
        )