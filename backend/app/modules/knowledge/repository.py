from sqlalchemy import case, or_, select
from sqlalchemy.orm import Session, load_only

from app.modules.knowledge.models import (
    KnowledgeArticle,
    KnowledgeArticleStatus,
)


class KnowledgeArticleRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def add(
        self,
        article: KnowledgeArticle,
    ) -> KnowledgeArticle:
        self.session.add(article)
        self.session.flush()

        return article

    def get_by_id(
        self,
        article_id: int,
    ) -> KnowledgeArticle | None:
        statement = select(KnowledgeArticle).where(
            KnowledgeArticle.id == article_id
        )

        return self.session.scalar(statement)

    def get_by_id_for_update(
        self,
        article_id: int,
    ) -> KnowledgeArticle | None:
        statement = (
            select(KnowledgeArticle)
            .where(KnowledgeArticle.id == article_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

        return self.session.scalar(statement)

    def get_by_source_incident_for_update(
        self,
        incident_id: int,
    ) -> KnowledgeArticle | None:
        statement = (
            select(KnowledgeArticle)
            .where(
                KnowledgeArticle.source_incident_id
                == incident_id
            )
            .with_for_update()
            .execution_options(populate_existing=True)
        )

        return self.session.scalar(statement)

    def list_summaries(
        self,
        *,
        status: KnowledgeArticleStatus | None,
        created_by_id: int | None = None,
        search: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> list[KnowledgeArticle]:
        if offset < 0:
            raise ValueError(
                "El desplazamiento no puede ser negativo."
            )

        if not 1 <= limit <= 100:
            raise ValueError(
                "El límite debe estar entre 1 y 100."
            )

        clean_search = search.strip() if search else ""

        if len(clean_search) > 200:
            raise ValueError(
                "La búsqueda no puede superar 200 caracteres."
            )

        statement = (
            select(KnowledgeArticle)
            .options(
                load_only(
                    KnowledgeArticle.id,
                    KnowledgeArticle.source_incident_id,
                    KnowledgeArticle.title,
                    KnowledgeArticle.status,
                    KnowledgeArticle.created_at,
                    KnowledgeArticle.updated_at,
                    KnowledgeArticle.published_at,
                    raiseload=True,
                )
            )
        )

        if status is not None:
            statement = statement.where(
                KnowledgeArticle.status == status
            )

        if created_by_id is not None:
            statement = statement.where(
                KnowledgeArticle.created_by_id == created_by_id
            )

        if clean_search:
            statement = statement.where(
                or_(
                    KnowledgeArticle.title.contains(
                        clean_search,
                        autoescape=True,
                    ),
                    KnowledgeArticle.problem_summary.contains(
                        clean_search,
                        autoescape=True,
                    ),
                )
            )

        statement = (
            statement
            .order_by(
                KnowledgeArticle.created_at.desc(),
                KnowledgeArticle.id.desc(),
            )
            .offset(offset)
            .limit(limit)
        )

        return list(
            self.session.scalars(statement).all()
        )

    def list_published_candidates(
        self,
        *,
        keywords: list[str],
        exclude_incident_id: int | None = None,
        limit: int = 10,
    ) -> list[KnowledgeArticle]:
        if not 1 <= limit <= 20:
            raise ValueError(
                "El límite debe estar entre 1 y 20."
            )

        clean_keywords = list(
            dict.fromkeys(
                keyword.strip().casefold()
                for keyword in keywords
                if keyword.strip()
            )
        )

        if len(clean_keywords) > 12:
            raise ValueError(
                "La búsqueda admite hasta 12 palabras clave."
            )

        if any(
            len(keyword) > 80
            for keyword in clean_keywords
        ):
            raise ValueError(
                "Cada palabra clave admite hasta 80 caracteres."
            )

        if not clean_keywords:
            return []

        conditions = []
        score_parts = []

        for keyword in clean_keywords:
            title_match = (
                KnowledgeArticle.title.icontains(
                    keyword,
                    autoescape=True,
                )
            )

            summary_match = (
                KnowledgeArticle.problem_summary.icontains(
                    keyword,
                    autoescape=True,
                )
            )

            conditions.append(
                or_(
                    title_match,
                    summary_match,
                )
            )

            score_parts.append(
                case(
                    (title_match, 3),
                    else_=0,
                )
                + case(
                    (summary_match, 1),
                    else_=0,
                )
            )

        relevance_score = sum(score_parts)

        statement = (
            select(KnowledgeArticle)
            .where(
                KnowledgeArticle.status
                == KnowledgeArticleStatus.PUBLISHED,
                or_(*conditions),
            )
        )

        if exclude_incident_id is not None:
            statement = statement.where(
                KnowledgeArticle.source_incident_id
                != exclude_incident_id
            )

        statement = (
            statement
            .order_by(
                relevance_score.desc(),
                KnowledgeArticle.published_at.desc(),
                KnowledgeArticle.id.desc(),
            )
            .limit(limit)
            .execution_options(populate_existing=True)
        )

        return list(
            self.session.scalars(statement).all()
        )