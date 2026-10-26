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
from app.modules.auth.dependencies import require_admin
from app.modules.incidents.dependencies import require_it_manager
from app.modules.users.repository import UserRepository
from app.modules.users.schemas import (
    TechnicianOptionResponse,
    UserCreate,
    UserResponse,
    UserRoleUpdate,
)
from app.modules.users.service import (
    UserEmailAlreadyExistsError,
    UserNotFoundError,
    UserService,
)


router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


def get_user_service(
    session: Annotated[Session, Depends(get_db)],
) -> UserService:
    return UserService(UserRepository(session))


@router.get(
    "",
    response_model=list[UserResponse],
    dependencies=[Depends(require_admin)],
)
def list_users(
    service: Annotated[UserService, Depends(get_user_service)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[UserResponse]:
    return service.list_users(
        offset=offset,
        limit=limit,
    )


@router.get(
    "/technicians",
    response_model=list[TechnicianOptionResponse],
    dependencies=[Depends(require_it_manager)],
)
def list_active_technicians(
    service: Annotated[UserService, Depends(get_user_service)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[TechnicianOptionResponse]:
    return service.list_active_technicians(
        offset=offset,
        limit=limit,
    )


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def create_user(
    data: UserCreate,
    service: Annotated[UserService, Depends(get_user_service)],
) -> UserResponse:
    try:
        return service.create_user(data)
    except UserEmailAlreadyExistsError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese correo.",
        ) from error


@router.patch(
    "/{user_id}/role",
    response_model=UserResponse,
    dependencies=[Depends(require_admin)],
)
def update_user_role(
    user_id: Annotated[int, Path(ge=1)],
    data: UserRoleUpdate,
    service: Annotated[UserService, Depends(get_user_service)],
) -> UserResponse:
    try:
        return service.update_role(
            user_id=user_id,
            data=data,
        )
    except UserNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El usuario no existe.",
        ) from error