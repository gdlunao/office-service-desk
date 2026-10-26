from datetime import datetime
from typing import Literal, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.modules.incidents.models import SolutionAttemptStatus


class SolutionAttemptStart(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        hide_input_in_errors=True,
    )

    solution_description: str = Field(
        min_length=10,
        max_length=10_000,
    )

    @field_validator("solution_description", mode="before")
    @classmethod
    def trim_description(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value


class SolutionAttemptFinish(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        hide_input_in_errors=True,
    )

    status: Literal["failed", "recovered"]

    solution_description: str = Field(
        min_length=10,
        max_length=10_000,
    )

    technical_actions: str = Field(
        min_length=10,
        max_length=10_000,
    )

    recovery_evidence: str | None = Field(
        default=None,
        min_length=10,
        max_length=10_000,
    )

    @field_validator(
        "solution_description",
        "technical_actions",
        "recovery_evidence",
        mode="before",
    )
    @classmethod
    def trim_text(cls, value: object) -> object:
        if isinstance(value, str):
            cleaned = value.strip()

            if not cleaned:
                return ""

            return cleaned

        return value

    @model_validator(mode="after")
    def require_recovery_evidence(self) -> Self:
        if (
            self.status == "recovered"
            and self.recovery_evidence is None
        ):
            raise ValueError(
                "Describe cómo comprobaste la recuperación "
                "del servicio."
            )

        return self


class SolutionAttemptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    incident_id: int
    technician_id: int
    technician_name: str
    attempt_number: int
    status: SolutionAttemptStatus
    solution_description: str | None
    technical_actions: str | None
    recovery_evidence: str | None
    started_at: datetime
    finished_at: datetime | None
    returned_at: datetime | None
    return_reason: str | None