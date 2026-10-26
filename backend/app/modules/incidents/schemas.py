from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.incidents.models import (
    IncidentEventType,
    IncidentStatus,
)

from app.modules.incidents.classification import (
    IncidentCategory,
    IncidentImpact,
    IncidentPriority,
    IncidentUrgency,
)

class IncidentCreate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        hide_input_in_errors=True,
    )

    title: str = Field(min_length=5, max_length=200)
    description: str = Field(min_length=10, max_length=10_000)

    @field_validator("title", "description", mode="before")
    @classmethod
    def trim_text(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value


class IncidentAssign(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        hide_input_in_errors=True,
    )

    assigned_to_id: int = Field(gt=0, strict=True)


class IncidentResolve(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        hide_input_in_errors=True,
    )

    resolution_summary: str = Field(
        min_length=10,
        max_length=10_000,
    )

    @field_validator("resolution_summary", mode="before")
    @classmethod
    def trim_resolution_summary(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

class IncidentClassificationUpdate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        hide_input_in_errors=True,
    )

    category: IncidentCategory
    impact: IncidentImpact
    urgency: IncidentUrgency

class IncidentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str

    reporter_id: int
    reporter_name: str

    status: IncidentStatus
    created_at: datetime

    assigned_to_id: int | None = None
    assigned_to_name: str | None = None

    assigned_by_id: int | None = None
    assigned_by_name: str | None = None

    assigned_at: datetime | None = None
    started_at: datetime | None = None
    resolution_summary: str | None = None
    resolved_at: datetime | None = None
    closed_at: datetime | None = None
    
    category: IncidentCategory | None = None
    impact: IncidentImpact | None = None
    urgency: IncidentUrgency | None = None
    priority: IncidentPriority | None = None
    classified_by_id: int | None = None
    classified_at: datetime | None = None

class IncidentEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    incident_id: int

    actor_id: int
    actor_name: str

    event_type: IncidentEventType
    previous_status: IncidentStatus | None
    new_status: IncidentStatus
    details: str | None
    created_at: datetime


class IncidentReturn(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        hide_input_in_errors=True,
    )

    reason: str = Field(
        min_length=10,
        max_length=2_000,
    )

    @field_validator("reason", mode="before")
    @classmethod
    def trim_reason(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value