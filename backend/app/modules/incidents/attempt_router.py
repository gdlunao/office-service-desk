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
from app.modules.incidents.attempt_schemas import (
    SolutionAttemptFinish,
    SolutionAttemptResponse,
    SolutionAttemptStart,
)
from app.modules.incidents.attempt_service import (
    SolutionAttemptConflictError,
    SolutionAttemptNotFoundError,
    SolutionAttemptPermissionError,
    SolutionAttemptService,
)
from app.modules.incidents.dependencies import require_technician
from app.modules.incidents.repository import IncidentRepository
from app.modules.users.models import User
from app.modules.auth.dependencies import get_current_user

router = APIRouter(
    prefix="/incidents/assigned",
    tags=["Solution attempts"],
)


def get_solution_attempt_service(
    session: Annotated[Session, Depends(get_db)],
) -> SolutionAttemptService:
    return SolutionAttemptService(
        IncidentRepository(session)
    )


@router.post(
    "/{incident_id}/attempts",
    response_model=SolutionAttemptResponse,
    status_code=status.HTTP_201_CREATED,
)
def start_solution_attempt(
    incident_id: Annotated[int, Path(ge=1)],
    data: SolutionAttemptStart,
    current_user: Annotated[User, Depends(require_technician)],
    service: Annotated[
        SolutionAttemptService,
        Depends(get_solution_attempt_service),
    ],
) -> SolutionAttemptResponse:
    try:
        return service.start_attempt(
            incident_id=incident_id,
            current_user=current_user,
            data=data,
        )
    except SolutionAttemptNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except SolutionAttemptPermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        ) from error
    except SolutionAttemptConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error


@router.patch(
    "/{incident_id}/attempts/{attempt_id}/finish",
    response_model=SolutionAttemptResponse,
)
def finish_solution_attempt(
    incident_id: Annotated[int, Path(ge=1)],
    attempt_id: Annotated[int, Path(ge=1)],
    data: SolutionAttemptFinish,
    current_user: Annotated[User, Depends(require_technician)],
    service: Annotated[
        SolutionAttemptService,
        Depends(get_solution_attempt_service),
    ],
) -> SolutionAttemptResponse:
    try:
        return service.finish_attempt(
            incident_id=incident_id,
            attempt_id=attempt_id,
            current_user=current_user,
            data=data,
        )
    except SolutionAttemptNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except SolutionAttemptPermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        ) from error
    except SolutionAttemptConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error

query_router = APIRouter(
prefix="/incidents",
tags=["Solution attempts"],
)


@query_router.get(
    "/{incident_id}/attempts",
    response_model=list[SolutionAttemptResponse],
)
def list_solution_attempts(
    incident_id: Annotated[int, Path(ge=1)],
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[
        SolutionAttemptService,
        Depends(get_solution_attempt_service),
    ],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[SolutionAttemptResponse]:
    try:
        return service.list_attempts(
            incident_id=incident_id,
            current_user=current_user,
            offset=offset,
            limit=limit,
        )
    except SolutionAttemptNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except SolutionAttemptPermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        ) from error

@query_router.get(
    "/{incident_id}/attempts/latest",
    response_model=SolutionAttemptResponse | None,
)
def get_latest_solution_attempt(
    incident_id: Annotated[int, Path(ge=1)],
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[
        SolutionAttemptService,
        Depends(get_solution_attempt_service),
    ],
) -> SolutionAttemptResponse | None:
    try:
        return service.get_latest_attempt(
            incident_id=incident_id,
            current_user=current_user,
        )
    except SolutionAttemptNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except SolutionAttemptPermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        ) from error