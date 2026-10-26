from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class KnowledgeRecommendationItem(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        hide_input_in_errors=True,
    )

    article_id: int = Field(gt=0)
    title: str
    problem_summary: str

    matched_keywords: list[str] = Field(
        default_factory=list,
        max_length=12,
    )


class IncidentKnowledgeRecommendationsResponse(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        hide_input_in_errors=True,
    )

    incident_id: int = Field(gt=0)

    search_keywords: list[str] = Field(
        default_factory=list,
        max_length=12,
    )

    recommendations: list[KnowledgeRecommendationItem] = Field(
        default_factory=list,
        max_length=20,
    )

    method: Literal["keyword_search"] = "keyword_search"
    requires_review: Literal[True] = True