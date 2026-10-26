from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    SecretStr,
    field_validator,
)

from app.modules.users.enums import UserRole


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    email: EmailStr = Field(max_length=254)
    password: SecretStr = Field(min_length=15, max_length=128)

    model_config = ConfigDict(
        extra="forbid",
        hide_input_in_errors=True,
    )

    @field_validator("full_name", mode="before")
    @classmethod
    def clean_full_name(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    is_active: bool
    role: UserRole
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class UserRoleUpdate(BaseModel):
    role: UserRole

    model_config = ConfigDict(
        extra="forbid",
        hide_input_in_errors=True,
    )
    
class TechnicianOptionResponse(BaseModel):
    id: int
    full_name: str

    model_config = ConfigDict(from_attributes=True)