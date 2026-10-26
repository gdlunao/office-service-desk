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

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.knowledge.repository import (
    KnowledgeArticleRepository,
)
from app.modules.knowledge.schemas import (
    KnowledgeArticleCreate,
    KnowledgeArticleResponse,
    KnowledgeArticleSummary,
    KnowledgeArticleDraftUpdate,
)
from app.modules.knowledge.service import (
    KnowledgeArticleAlreadyExistsError,
    KnowledgeArticlePermissionError,
    KnowledgeArticleService,
    KnowledgeArticleSourceError,
    KnowledgeArticleSourceNotFoundError,
    KnowledgeArticleNotFoundError,
    KnowledgeArticleConflictError,
)
from app.modules.users.models import User
from app.modules.knowledge.models import KnowledgeArticleStatus

router = APIRouter(
    prefix="/knowledge/articles",
    tags=["Knowledge"],
)


def get_knowledge_article_service(
    session: Annotated[Session, Depends(get_db)],
) -> KnowledgeArticleService:
    return KnowledgeArticleService(
        KnowledgeArticleRepository(session)
    )


@router.post(
    "",
    response_model=KnowledgeArticleResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_knowledge_article_draft(
    data: KnowledgeArticleCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[
        KnowledgeArticleService,
        Depends(get_knowledge_article_service),
    ],
) -> KnowledgeArticleResponse:
    try:
        return service.create_draft(
            data=data,
            current_user=current_user,
        )
    except KnowledgeArticlePermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        ) from error
    except KnowledgeArticleSourceNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except (
        KnowledgeArticleSourceError,
        KnowledgeArticleAlreadyExistsError,
    ) as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error

@router.get(
    "/{article_id}",
    response_model=KnowledgeArticleResponse,
)
def get_knowledge_article(
    article_id: Annotated[int, Path(ge=1)],
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[
        KnowledgeArticleService,
        Depends(get_knowledge_article_service),
    ],
) -> KnowledgeArticleResponse:
    try:
        return service.get_article(
            article_id=article_id,
            current_user=current_user,
        )
    except KnowledgeArticlePermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        ) from error
    except KnowledgeArticleNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El artículo no está disponible.",
        ) from error

@router.get(
    "",
    response_model=list[KnowledgeArticleSummary],
)
def list_knowledge_articles(
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[
        KnowledgeArticleService,
        Depends(get_knowledge_article_service),
    ],
    article_status: Annotated[
        KnowledgeArticleStatus,
        Query(alias="status"),
    ] = KnowledgeArticleStatus.PUBLISHED,
    search: Annotated[
        str | None,
        Query(max_length=200),
    ] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[KnowledgeArticleSummary]:
    try:
        return service.list_articles(
            current_user=current_user,
            status=article_status,
            search=search,
            offset=offset,
            limit=limit,
        )
    except KnowledgeArticlePermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        ) from error


@router.patch(
    "/{article_id}",
    response_model=KnowledgeArticleResponse,
)
def update_knowledge_article_draft(
    article_id: Annotated[int, Path(ge=1)],
    data: KnowledgeArticleDraftUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[
        KnowledgeArticleService,
        Depends(get_knowledge_article_service),
    ],
) -> KnowledgeArticleResponse:
    try:
        return service.update_draft(
            article_id=article_id,
            data=data,
            current_user=current_user,
        )
    except KnowledgeArticlePermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        ) from error
    except KnowledgeArticleNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El artículo no está disponible.",
        ) from error
    except KnowledgeArticleConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error


@router.patch(
    "/{article_id}/publish",
    response_model=KnowledgeArticleResponse,
)
def publish_knowledge_article(
    article_id: Annotated[int, Path(ge=1)],
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[
        KnowledgeArticleService,
        Depends(get_knowledge_article_service),
    ],
) -> KnowledgeArticleResponse:
    try:
        return service.publish_article(
            article_id=article_id,
            current_user=current_user,
        )
    except KnowledgeArticlePermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        ) from error
    except KnowledgeArticleNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El artículo no está disponible.",
        ) from error
    except KnowledgeArticleConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error