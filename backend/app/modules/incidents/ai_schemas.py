from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.incidents.classification import (
    IncidentCategory,
    IncidentImpact,
    IncidentPriority,
    IncidentUrgency,
)


class IncidentClassificationAIOutput(BaseModel):
    """Contenido esperado de la respuesta del proveedor de IA."""

    model_config = ConfigDict(
        extra="forbid",
        hide_input_in_errors=True,
    )

    category: IncidentCategory
    impact: IncidentImpact
    urgency: IncidentUrgency

    explanation: str = Field(
        min_length=10,
        max_length=2_000,
    )

    @field_validator("explanation", mode="before")
    @classmethod
    def trim_explanation(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value


class IncidentClassificationSuggestionResponse(
    IncidentClassificationAIOutput
):
    """Sugerencia que el servidor entrega para revisión humana."""

    incident_id: int = Field(gt=0)
    priority: IncidentPriority

    provider: Literal["gemini"] = "gemini"

    model: str = Field(
        min_length=1,
        max_length=100,
    )

    requires_review: Literal[True] = True