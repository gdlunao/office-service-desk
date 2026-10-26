from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Path,
    Query,
    status,
)
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.modules.incidents.dependencies import require_technician
from app.modules.knowledge.recommendation_ai_client import (
    GeminiKnowledgeAssistanceClient,
    KnowledgeAIInvalidResponseError,
    KnowledgeAIUnavailableError,
)
from app.modules.knowledge.recommendation_ai_schemas import (
    IncidentKnowledgeAssistanceResponse,
)
from app.modules.knowledge.recommendation_ai_service import (
    KnowledgeAssistanceConflictError,
    KnowledgeAssistanceService,
)
from app.modules.knowledge.recommendation_schemas import (
    IncidentKnowledgeRecommendationsResponse,
)
from app.modules.knowledge.recommendation_service import (
    KnowledgeRecommendationNotFoundError,
    KnowledgeRecommendationPermissionError,
    KnowledgeRecommendationService,
)
from app.modules.knowledge.repository import (
    KnowledgeArticleRepository,
)
from app.modules.users.models import User


router = APIRouter(
    prefix="/incidents/assigned",
    tags=["Knowledge recommendations"],
)


def get_recommendation_service(
    session: Annotated[Session, Depends(get_db)],
) -> KnowledgeRecommendationService:
    return KnowledgeRecommendationService(
        KnowledgeArticleRepository(session)
    )


def get_knowledge_assistance_service(
    session: Annotated[Session, Depends(get_db)],
) -> KnowledgeAssistanceService:
    return KnowledgeAssistanceService(
        repository=KnowledgeArticleRepository(session),
        client=GeminiKnowledgeAssistanceClient(
            get_settings()
        ),
    )


@router.get(
    "/{incident_id}/knowledge-recommendations",
    response_model=IncidentKnowledgeRecommendationsResponse,
)
def get_incident_knowledge_recommendations(
    incident_id: Annotated[int, Path(ge=1)],
    current_user: Annotated[User, Depends(require_technician)],
    service: Annotated[
        KnowledgeRecommendationService,
        Depends(get_recommendation_service),
    ],
    limit: Annotated[int, Query(ge=1, le=20)] = 5,
) -> IncidentKnowledgeRecommendationsResponse:
    try:
        return service.recommend_for_incident(
            incident_id=incident_id,
            current_user=current_user,
            limit=limit,
        )
    except KnowledgeRecommendationPermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        ) from error
    except KnowledgeRecommendationNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error


@router.post(
    "/{incident_id}/knowledge-assistance",
    response_model=IncidentKnowledgeAssistanceResponse,
)
def suggest_incident_knowledge_assistance(
    incident_id: Annotated[int, Path(ge=1)],
    current_user: Annotated[User, Depends(require_technician)],
    service: Annotated[
        KnowledgeAssistanceService,
        Depends(get_knowledge_assistance_service),
    ],
) -> IncidentKnowledgeAssistanceResponse:
    try:
        return service.suggest_for_incident(
            incident_id=incident_id,
            current_user=current_user,
        )
    except KnowledgeRecommendationPermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        ) from error
    except KnowledgeRecommendationNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except KnowledgeAssistanceConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error
    except KnowledgeAIUnavailableError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        ) from error
    except KnowledgeAIInvalidResponseError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(error),
        ) from error