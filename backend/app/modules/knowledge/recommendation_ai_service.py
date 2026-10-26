from app.modules.incidents.models import IncidentStatus
from app.modules.knowledge.models import KnowledgeArticleStatus
from app.modules.knowledge.recommendation_ai_client import (
    GeminiKnowledgeAssistanceClient,
    KnowledgeAIInvalidResponseError,
)
from app.modules.knowledge.recommendation_ai_schemas import (
    IncidentKnowledgeAssistanceResponse,
)
from app.modules.knowledge.recommendation_service import (
    KnowledgeRecommendationNotFoundError,
    KnowledgeRecommendationService,
)
from app.modules.knowledge.repository import (
    KnowledgeArticleRepository,
)
from app.modules.knowledge.schemas import KnowledgeArticleResponse
from app.modules.users.models import User


class KnowledgeAssistanceConflictError(Exception):
    pass


class KnowledgeAssistanceService:
    def __init__(
        self,
        repository: KnowledgeArticleRepository,
        client: GeminiKnowledgeAssistanceClient,
    ) -> None:
        self.repository = repository
        self.client = client

        self.recommendation_service = (
            KnowledgeRecommendationService(repository)
        )

    def suggest_for_incident(
        self,
        *,
        incident_id: int,
        current_user: User,
    ) -> IncidentKnowledgeAssistanceResponse:
        recommendations = (
            self.recommendation_service.recommend_for_incident(
                incident_id=incident_id,
                current_user=current_user,
                limit=5,
            )
        )

        incident = (
            self.recommendation_service
            .incident_repository
            .get_by_id(incident_id)
        )

        if (
            incident is None
            or incident.assigned_to_id != current_user.id
        ):
            raise KnowledgeRecommendationNotFoundError(
                "La incidencia no está disponible para tu cuenta."
            )

        if (
            incident.status not in (
                IncidentStatus.ASSIGNED,
                IncidentStatus.IN_PROGRESS,
            )
            or incident.resolved_at is not None
            or incident.closed_at is not None
        ):
            raise KnowledgeAssistanceConflictError(
                "La orientación técnica está disponible "
                "para incidencias asignadas o en atención."
            )

        articles: list[KnowledgeArticleResponse] = []
        sources_by_id = {}

        for item in recommendations.recommendations:
            article = self.repository.get_by_id(
                item.article_id
            )

            if (
                article is None
                or article.status
                != KnowledgeArticleStatus.PUBLISHED
            ):
                continue

            articles.append(
                KnowledgeArticleResponse.model_validate(
                    article
                )
            )

            sources_by_id[article.id] = item

        if not articles:
            raise KnowledgeAssistanceConflictError(
                "No se encontraron artículos publicados "
                "relacionados para fundamentar la orientación. "
                "Puedes continuar con la atención manual."
            )

        result = self.client.suggest_assistance(
            title=incident.title,
            description=incident.description,
            articles=articles,
        )

        cited_ids = result.source_article_ids

        if (
            not cited_ids
            or len(cited_ids) != len(set(cited_ids))
            or any(
                article_id not in sources_by_id
                for article_id in cited_ids
            )
        ):
            raise KnowledgeAIInvalidResponseError(
                "La orientación contiene referencias "
                "que no corresponden a las fuentes disponibles."
            )

        return IncidentKnowledgeAssistanceResponse(
            **result.model_dump(),
            incident_id=incident.id,
            sources=[
                sources_by_id[article_id]
                for article_id in cited_ids
            ],
            model=self.client.settings.gemini_model.strip(),
        )