from datetime import datetime
from enum import Enum

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum as SQLAlchemyEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base
from app.modules.incidents.models import utc_now


class KnowledgeArticleStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class KnowledgeArticle(Base):
    __tablename__ = "knowledge_articles"

    __table_args__ = (
        UniqueConstraint(
            "source_incident_id",
            name="uq_knowledge_articles_source_incident",
        ),
        CheckConstraint(
            "status <> 'published' OR "
            "(published_by_id IS NOT NULL "
            "AND published_at IS NOT NULL)",
            name="ck_knowledge_articles_publication_metadata",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    source_incident_id: Mapped[int] = mapped_column(
        ForeignKey(
            "incidents.id",
            name="fk_knowledge_articles_source_incident",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )

    source_attempt_id: Mapped[int] = mapped_column(
        ForeignKey(
            "incident_solution_attempts.id",
            name="fk_knowledge_articles_source_attempt",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    problem_summary: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    solution_description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    technical_actions: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    recovery_evidence: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    status: Mapped[KnowledgeArticleStatus] = mapped_column(
        SQLAlchemyEnum(
            KnowledgeArticleStatus,
            name="knowledge_article_status",
            native_enum=False,
            create_constraint=True,
            values_callable=lambda enum_type: [
                item.value for item in enum_type
            ],
            validate_strings=True,
            length=20,
        ),
        nullable=False,
        default=KnowledgeArticleStatus.DRAFT,
        server_default=KnowledgeArticleStatus.DRAFT.value,
        index=True,
    )

    created_by_id: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id",
            name="fk_knowledge_articles_created_by",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )

    published_by_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "users.id",
            name="fk_knowledge_articles_published_by",
            ondelete="RESTRICT",
        ),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )

    published_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )