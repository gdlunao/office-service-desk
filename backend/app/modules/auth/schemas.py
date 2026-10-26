from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.modules.users.enums import UserRole


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"


class CurrentUserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    is_active: bool
    is_admin: bool
    role: UserRole

    model_config = ConfigDict(from_attributes=True)