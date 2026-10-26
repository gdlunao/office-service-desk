import re
import unicodedata

from app.modules.incidents.repository import IncidentRepository
from app.modules.knowledge.recommendation_schemas import (
    IncidentKnowledgeRecommendationsResponse,
    KnowledgeRecommendationItem,
)
from app.modules.knowledge.repository import (
    KnowledgeArticleRepository,
)
from app.modules.users.enums import UserRole
from app.modules.users.models import User


class KnowledgeRecommendationPermissionError(Exception):
    pass


class KnowledgeRecommendationNotFoundError(Exception):
    pass


STOP_WORDS = frozenset(
    """
    para como desde hasta entre sobre porque cuando donde
    esta este estos estas tiene tienen puede pueden permite
    permiten hacer realizar sistema problema incidencia error
    falla presenta indica intentar vuelve aparece muestra
    mediante tambien solamente solo cada unos unas
    los las del una uno que con por sin sus ese esa esos esas
    al se el la un de en es y o a
    pero mismo misma mismos mismas esto eso hay ser sido
    sigue siguen continuar ocurre ocurrir repetir nuevamente
    todavia antes despues correctamente funcionamiento
    servicio servicios usuario usuarios equipo equipos
    documento documentos archivo archivos recepcion
    registrado registrada
    """.split()
)

MAX_SEARCH_KEYWORDS = 12
MIN_MATCHED_KEYWORDS = 2


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize(
        "NFKD",
        value.casefold(),
    )

    return "".join(
        character
        for character in normalized
        if not unicodedata.combining(character)
    )


def extract_search_keywords(
    title: str,
    description: str,
) -> list[str]:
    text = normalize_text(f"{title} {description}")

    words = re.findall(r"[a-z0-9]+", text)
    keywords: list[str] = []

    for word in words:
        if (
            len(word) < 4
            or len(word) > 80
            or word.isdigit()
            or word in STOP_WORDS
            or word in keywords
        ):
            continue

        keywords.append(word)

        if len(keywords) == MAX_SEARCH_KEYWORDS:
            break

    return keywords


def get_matched_keywords(
    keywords: list[str],
    article_title: str,
    problem_summary: str,
) -> list[str]:
    searchable_text = normalize_text(
        f"{article_title} {problem_summary}"
    )

    article_words = set(
        re.findall(r"[a-z0-9]+", searchable_text)
    )

    return [
        keyword
        for keyword in keywords
        if keyword in article_words
    ]


class KnowledgeRecommendationService:
    def __init__(
        self,
        repository: KnowledgeArticleRepository,
    ) -> None:
        self.repository = repository

        self.incident_repository = IncidentRepository(
            repository.session
        )

    def recommend_for_incident(
        self,
        *,
        incident_id: int,
        current_user: User,
        limit: int = 5,
    ) -> IncidentKnowledgeRecommendationsResponse:
        if (
            not current_user.is_active
            or current_user.role != UserRole.TECHNICIAN
        ):
            raise KnowledgeRecommendationPermissionError(
                "Se requiere una cuenta activa con rol de técnico."
            )

        if not 1 <= limit <= 20:
            raise ValueError(
                "El límite debe estar entre 1 y 20."
            )

        incident = self.incident_repository.get_by_id(
            incident_id
        )

        if (
            incident is None
            or incident.assigned_to_id != current_user.id
        ):
            raise KnowledgeRecommendationNotFoundError(
                "La incidencia no está disponible para tu cuenta."
            )

        keywords = extract_search_keywords(
            incident.title,
            incident.description,
        )

        if not keywords:
            return IncidentKnowledgeRecommendationsResponse(
                incident_id=incident.id,
                search_keywords=[],
                recommendations=[],
            )

        candidates = self.repository.list_published_candidates(
            keywords=keywords,
            exclude_incident_id=incident.id,
            limit=20,
        )

        recommendations: list[KnowledgeRecommendationItem] = []

        for article in candidates:
            matched_keywords = get_matched_keywords(
                keywords,
                article.title,
                article.problem_summary,
            )

            if len(matched_keywords) < MIN_MATCHED_KEYWORDS:
                continue

            recommendations.append(
                KnowledgeRecommendationItem(
                    article_id=article.id,
                    title=article.title,
                    problem_summary=article.problem_summary,
                    matched_keywords=matched_keywords,
                )
            )

        # Orden estable: más coincidencias primero.
        recommendations.sort(
            key=lambda item: len(item.matched_keywords),
            reverse=True,
        )

        return IncidentKnowledgeRecommendationsResponse(
            incident_id=incident.id,
            search_keywords=keywords,
            recommendations=recommendations[:limit],
        )