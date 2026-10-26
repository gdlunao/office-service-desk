from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class ResolutionTimeIndicator(BaseModel):
    evaluated_incidents: int = Field(ge=0)
    excluded_incidents: int = Field(ge=0)

    average_minutes: float | None = Field(
        default=None,
        ge=0,
        allow_inf_nan=False,
    )


class PercentageIndicator(BaseModel):
    evaluated_incidents: int = Field(ge=0)
    excluded_incidents: int = Field(ge=0)
    matching_incidents: int = Field(ge=0)

    percentage: float | None = Field(
        default=None,
        ge=0,
        le=100,
        allow_inf_nan=False,
    )


class IncidentIndicatorsResponse(BaseModel):
    data_scope: Literal["operational"] = "operational"

    period_start: date | None = None
    period_end: date | None = None

    resolved_incidents: int = Field(ge=0)

    resolution_time: ResolutionTimeIndicator
    first_solution_recovery: PercentageIndicator
    complete_documentation: PercentageIndicator