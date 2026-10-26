from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.knowledge.recommendation_schemas import (
    KnowledgeRecommendationItem,
)


SuggestedCheck = Annotated[
    str,
    Field(min_length=10, max_length=1_000),
]

SourceArticleId = Annotated[
    int,
    Field(gt=0, strict=True),
]


class KnowledgeAssistanceAIOutput(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        hide_input_in_errors=True,
        str_strip_whitespace=True,
    )

    explanation: str = Field(
        min_length=10,
        max_length=2_000,
    )

    suggested_checks: list[SuggestedCheck] = Field(
        min_length=1,
        max_length=6,
    )

    source_article_ids: list[SourceArticleId] = Field(
        min_length=1,
        max_length=5,
    )


class IncidentKnowledgeAssistanceResponse(
    KnowledgeAssistanceAIOutput
):
    incident_id: int = Field(gt=0)

    sources: list[KnowledgeRecommendationItem] = Field(
        min_length=1,
        max_length=5,
    )

    provider: Literal["gemini"] = "gemini"
    model: str = Field(min_length=1, max_length=100)
    requires_review: Literal[True] = True