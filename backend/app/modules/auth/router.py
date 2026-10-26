from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.schemas import CurrentUserResponse, TokenResponse
from app.modules.auth.service import (
    AuthService,
    InvalidCredentialsError,
)
from app.modules.users.repository import UserRepository

from app.modules.auth.dependencies import get_current_user
from app.modules.users.models import User

router = APIRouter(
    prefix="/auth",
    tags=["Auth"],
)


def get_auth_service(
    session: Annotated[Session, Depends(get_db)],
) -> AuthService:
    return AuthService(UserRepository(session))


@router.post("/token", response_model=TokenResponse)
def login(
    response: Response,
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> TokenResponse:
    try:
        result = service.login(
            email=form.username,
            password=form.password,
        )
    except InvalidCredentialsError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contrasena incorrectos.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error

    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"

    return result


@router.get("/me", response_model=CurrentUserResponse)
def read_current_user(
    user: Annotated[User, Depends(get_current_user)],
) -> CurrentUserResponse:
    return CurrentUserResponse.model_validate(user)