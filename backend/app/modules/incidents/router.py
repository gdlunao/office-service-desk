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
from app.modules.incidents.dependencies import (
    require_it_manager,
    require_technician,
)
from app.modules.incidents.repository import IncidentRepository
from app.modules.incidents.schemas import (
    IncidentAssign,
    IncidentCreate,
    IncidentEventResponse,
    IncidentResolve,
    IncidentResponse,
    IncidentReturn,
    IncidentClassificationUpdate,
)

from app.modules.incidents.service import (
    IncidentAssignmentConflictError,
    IncidentNotFoundError,
    IncidentService,
    IncidentStartConflictError,
    InvalidIncidentAssigneeError,
    IncidentResolutionConflictError,
    IncidentClosureConflictError,
    IncidentReturnConflictError,
    IncidentClassificationConflictError,
    IncidentClassificationPermissionError,
)

from app.modules.users.models import User

from app.core.config import get_settings
from app.modules.incidents.ai_client import (
    GeminiClassificationClient,
    IncidentAIInvalidResponseError,
    IncidentAIUnavailableError,
)
from app.modules.incidents.ai_schemas import (
    IncidentClassificationSuggestionResponse,
)
from app.modules.incidents.ai_service import (
    IncidentAIService,
    IncidentAISuggestionConflictError,
    IncidentAISuggestionPermissionError,
)

router = APIRouter(
    prefix="/incidents",
    tags=["Incidents"],
)


def get_incident_service(
    session: Annotated[Session, Depends(get_db)],
) -> IncidentService:
    return IncidentService(IncidentRepository(session))

def get_incident_ai_service(
    session: Annotated[Session, Depends(get_db)],
) -> IncidentAIService:
    return IncidentAIService(
        repository=IncidentRepository(session),
        client=GeminiClassificationClient(get_settings()),
    )

@router.post(
    "",
    response_model=IncidentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_incident(
    data: IncidentCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[IncidentService, Depends(get_incident_service)],
) -> IncidentResponse:
    return service.create_incident(
        data=data,
        reporter_id=current_user.id,
    )




@router.get("", response_model=list[IncidentResponse])
def list_my_incidents(
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[IncidentService, Depends(get_incident_service)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[IncidentResponse]:
    return service.list_my_incidents(
        reporter_id=current_user.id,
        offset=offset,
        limit=limit,
    )


@router.get(
    "/queue",
    response_model=list[IncidentResponse],
    dependencies=[Depends(require_it_manager)],
)
def list_incident_queue(
    service: Annotated[IncidentService, Depends(get_incident_service)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[IncidentResponse]:
    return service.list_all_incidents(
        offset=offset,
        limit=limit,
    )


@router.get(
    "/queue/{incident_id}",
    response_model=IncidentResponse,
    dependencies=[Depends(require_it_manager)],
)
def get_queue_incident(
    incident_id: Annotated[int, Path(ge=1)],
    service: Annotated[IncidentService, Depends(get_incident_service)],
) -> IncidentResponse:
    try:
        return service.get_queue_incident(
            incident_id=incident_id,
        )
    except IncidentNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La incidencia no está disponible.",
        ) from error


@router.patch(
    "/queue/{incident_id}/assignment",
    response_model=IncidentResponse,
)
def assign_incident(
    incident_id: Annotated[int, Path(ge=1)],
    data: IncidentAssign,
    current_user: Annotated[User, Depends(require_it_manager)],
    service: Annotated[IncidentService, Depends(get_incident_service)],
) -> IncidentResponse:
    try:
        return service.assign_incident(
            incident_id=incident_id,
            data=data,
            assigned_by_id=current_user.id,
        )
    except IncidentNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La incidencia no está disponible.",
        ) from error
    except InvalidIncidentAssigneeError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Selecciona una cuenta activa con rol de técnico.",
        ) from error
    except IncidentAssignmentConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Solo se pueden asignar incidencias reportadas "
                "que todavía no tengan una asignación."
            ),
        ) from error


@router.get(
    "/assigned",
    response_model=list[IncidentResponse],
)
def list_my_assignments(
    current_user: Annotated[User, Depends(require_technician)],
    service: Annotated[IncidentService, Depends(get_incident_service)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[IncidentResponse]:
    return service.list_my_assignments(
        assignee_id=current_user.id,
        offset=offset,
        limit=limit,
    )


@router.get(
    "/assigned/{incident_id}",
    response_model=IncidentResponse,
)
def get_my_assignment(
    incident_id: Annotated[int, Path(ge=1)],
    current_user: Annotated[User, Depends(require_technician)],
    service: Annotated[IncidentService, Depends(get_incident_service)],
) -> IncidentResponse:
    try:
        return service.get_my_assignment(
            incident_id=incident_id,
            assignee_id=current_user.id,
        )
    except IncidentNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La incidencia no está disponible.",
        ) from error


@router.patch(
    "/assigned/{incident_id}/start",
    response_model=IncidentResponse,
)
def start_assigned_incident(
    incident_id: Annotated[int, Path(ge=1)],
    current_user: Annotated[User, Depends(require_technician)],
    service: Annotated[IncidentService, Depends(get_incident_service)],
) -> IncidentResponse:
    try:
        return service.start_incident(
            incident_id=incident_id,
            assignee_id=current_user.id,
        )
    except IncidentNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La incidencia no está disponible.",
        ) from error
    except IncidentStartConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "La incidencia ya fue iniciada "
                "o no está en estado Asignada."
            ),
        ) from error


@router.patch(
    "/assigned/{incident_id}/resolve",
    response_model=IncidentResponse,
)
def resolve_assigned_incident(
    incident_id: Annotated[int, Path(ge=1)],
    data: IncidentResolve,
    current_user: Annotated[User, Depends(require_technician)],
    service: Annotated[
        IncidentService,
        Depends(get_incident_service),
    ],
) -> IncidentResponse:
    try:
        return service.resolve_incident(
            incident_id=incident_id,
            assignee_id=current_user.id,
            data=data,
        )
    except IncidentNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La incidencia no está disponible.",
        ) from error
    except IncidentResolutionConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Solo se pueden resolver incidencias "
                "en atención que todavía no tengan "
                "una solución registrada."
            ),
        ) from error

@router.patch(
    "/{incident_id}/close",
    response_model=IncidentResponse,
)
def close_my_incident(
    incident_id: Annotated[int, Path(ge=1)],
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[
        IncidentService,
        Depends(get_incident_service),
    ],
) -> IncidentResponse:
    try:
        return service.close_incident(
            incident_id=incident_id,
            reporter_id=current_user.id,
        )
    except IncidentNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La incidencia no está disponible.",
        ) from error
    except IncidentClosureConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Solo se pueden cerrar incidencias "
                "resueltas y pendientes de confirmación."
            ),
        ) from error

@router.patch(
    "/{incident_id}/return",
    response_model=IncidentResponse,
)
def return_incident(
    incident_id: Annotated[int, Path(ge=1)],
    data: IncidentReturn,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[
        IncidentService,
        Depends(get_incident_service),
    ],
) -> IncidentResponse:
    try:
        return service.return_incident(
            incident_id=incident_id,
            reporter_id=current_user.id,
            data=data,
        )
    except IncidentNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La incidencia no está disponible.",
        ) from error
    except IncidentReturnConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Solo se pueden devolver incidencias "
                "resueltas y pendientes de confirmación "
                "que conserven su asignación y solución."
            ),
        ) from error

@router.patch(
    "/queue/{incident_id}/classification",
    response_model=IncidentResponse,
)
def classify_incident(
    incident_id: Annotated[int, Path(ge=1)],
    data: IncidentClassificationUpdate,
    current_user: Annotated[User, Depends(require_it_manager)],
    service: Annotated[
        IncidentService,
        Depends(get_incident_service),
    ],
) -> IncidentResponse:
    try:
        return service.classify_incident(
            incident_id=incident_id,
            data=data,
            current_user=current_user,
        )
    except IncidentClassificationPermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        ) from error
    except IncidentNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except IncidentClassificationConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error
        
@router.get("/{incident_id}", response_model=IncidentResponse)
def get_my_incident(
    incident_id: Annotated[int, Path(ge=1)],
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[IncidentService, Depends(get_incident_service)],
) -> IncidentResponse:
    try:
        return service.get_my_incident(
            incident_id=incident_id,
            reporter_id=current_user.id,
        )
    except IncidentNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La incidencia no está disponible.",
        ) from error

@router.get(
    "/{incident_id}/events",
    response_model=list[IncidentEventResponse],
)
def list_incident_events(
    incident_id: Annotated[int, Path(ge=1)],
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[
        IncidentService,
        Depends(get_incident_service),
    ],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[IncidentEventResponse]:
    try:
        return service.list_incident_events(
            incident_id=incident_id,
            current_user=current_user,
            offset=offset,
            limit=limit,
        )
    except IncidentNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La incidencia no está disponible.",
        ) from error

@router.post(
    "/queue/{incident_id}/classification-suggestion",
    response_model=IncidentClassificationSuggestionResponse,
)
def suggest_incident_classification(
    incident_id: Annotated[int, Path(ge=1)],
    current_user: Annotated[User, Depends(require_it_manager)],
    service: Annotated[
        IncidentAIService,
        Depends(get_incident_ai_service),
    ],
) -> IncidentClassificationSuggestionResponse:
    try:
        return service.suggest_classification(
            incident_id=incident_id,
            current_user=current_user,
        )
    except IncidentAISuggestionPermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        ) from error
    except IncidentNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except IncidentAISuggestionConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error
    except IncidentAIUnavailableError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        ) from error
    except IncidentAIInvalidResponseError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(error),
        ) from error