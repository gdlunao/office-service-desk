from typing import Annotated

from fastapi import Depends, HTTPException, status

from app.modules.auth.dependencies import get_current_user
from app.modules.users.enums import UserRole
from app.modules.users.models import User


def require_it_manager(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if current_user.role != UserRole.IT_MANAGER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere el rol de responsable TI.",
        )

    return current_user

def require_technician(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if current_user.role != UserRole.TECHNICIAN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere el rol de técnico.",
        )

    return current_user