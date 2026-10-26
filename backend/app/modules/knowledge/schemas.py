from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)

from app.modules.knowledge.models import KnowledgeArticleStatus


class KnowledgeArticleCreate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        hide_input_in_errors=True,
    )

    source_incident_id: int = Field(
        gt=0,
        strict=True,
    )


class KnowledgeArticleDraftUpdate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        hide_input_in_errors=True,
    )

    title: str = Field(
        min_length=5,
        max_length=200,
    )

    problem_summary: str = Field(
        min_length=10,
        max_length=10_000,
    )

    solution_description: str = Field(
        min_length=10,
        max_length=10_000,
    )

    technical_actions: str = Field(
        min_length=10,
        max_length=10_000,
    )

    recovery_evidence: str = Field(
        min_length=10,
        max_length=10_000,
    )

    @field_validator(
        "title",
        "problem_summary",
        "solution_description",
        "technical_actions",
        "recovery_evidence",
        mode="before",
    )
    @classmethod
    def trim_text(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()

        return value


class KnowledgeArticleSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_incident_id: int
    title: str
    status: KnowledgeArticleStatus
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None


class KnowledgeArticleResponse(KnowledgeArticleSummary):
    source_attempt_id: int
    problem_summary: str
    solution_description: str
    technical_actions: str
    recovery_evidence: str
    created_by_id: int
    published_by_id: int | None