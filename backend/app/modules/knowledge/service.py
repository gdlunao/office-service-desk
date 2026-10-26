from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from app.modules.incidents.attempt_repository import (
    SolutionAttemptRepository,
)
from app.modules.incidents.models import (
    IncidentStatus,
    SolutionAttemptStatus,
    utc_now,
)
from app.modules.incidents.repository import IncidentRepository
from app.modules.knowledge.models import (
    KnowledgeArticle,
    KnowledgeArticleStatus,
)
from app.modules.knowledge.repository import (
    KnowledgeArticleRepository,
)

from app.modules.users.enums import UserRole
from app.modules.users.models import User

from app.modules.knowledge.schemas import (
    KnowledgeArticleCreate,
    KnowledgeArticleDraftUpdate,
    KnowledgeArticleResponse,
    KnowledgeArticleSummary,
)

class KnowledgeArticlePermissionError(Exception):
    pass


class KnowledgeArticleSourceNotFoundError(Exception):
    pass


class KnowledgeArticleSourceError(Exception):
    pass


class KnowledgeArticleAlreadyExistsError(Exception):
    pass

class KnowledgeArticleNotFoundError(Exception):
    pass


class KnowledgeArticleConflictError(Exception):
    pass

class KnowledgeArticleService:
    def __init__(
        self,
        repository: KnowledgeArticleRepository,
    ) -> None:
        self.repository = repository

        self.incident_repository = IncidentRepository(
            repository.session
        )

        self.attempt_repository = SolutionAttemptRepository(
            repository.session
        )

    def create_draft(
        self,
        *,
        data: KnowledgeArticleCreate,
        current_user: User,
    ) -> KnowledgeArticleResponse:
        session = self.repository.session

        try:
            if (
                not current_user.is_active
                or current_user.role not in (
                    UserRole.TECHNICIAN,
                    UserRole.IT_MANAGER,
                )
            ):
                raise KnowledgeArticlePermissionError(
                    "Se requiere una cuenta activa de técnico "
                    "o responsable TI."
                )

            incident = (
                self.incident_repository.get_by_id_for_update(
                    data.source_incident_id
                )
            )

            if incident is None:
                raise KnowledgeArticleSourceNotFoundError(
                    "La incidencia no está disponible."
                )

            if (
                current_user.role == UserRole.TECHNICIAN
                and incident.assigned_to_id != current_user.id
            ):
                raise KnowledgeArticleSourceNotFoundError(
                    "La incidencia no está disponible."
                )

            if (
                incident.status != IncidentStatus.CLOSED
                or incident.closed_at is None
                or incident.resolved_at is None
                or incident.started_at is None
                or incident.assigned_to_id is None
                or not incident.resolution_summary
            ):
                raise KnowledgeArticleSourceError(
                    "La incidencia debe estar cerrada y conservar "
                    "su recuperación y asignación."
                )

            if not (
                incident.started_at
                <= incident.resolved_at
                <= incident.closed_at
            ):
                raise KnowledgeArticleSourceError(
                    "Las fechas de la incidencia no son consistentes."
                )

            existing_article = (
                self.repository
                .get_by_source_incident_for_update(
                    incident.id
                )
            )

            if existing_article is not None:
                raise KnowledgeArticleAlreadyExistsError(
                    "Esta incidencia ya tiene un artículo "
                    "de conocimiento."
                )

            attempt = (
                self.attempt_repository.get_latest_for_update(
                    incident.id
                )
            )

            if (
                attempt is None
                or attempt.status
                != SolutionAttemptStatus.RECOVERED
                or attempt.finished_at is None
                or attempt.finished_at != incident.resolved_at
                or attempt.returned_at is not None
                or attempt.technician_id
                != incident.assigned_to_id
            ):
                raise KnowledgeArticleSourceError(
                    "La incidencia debe tener un último intento "
                    "recuperado que coincida con su resolución."
                )

            if attempt.finished_at < attempt.started_at:
                raise KnowledgeArticleSourceError(
                    "Las fechas del intento no son consistentes."
                )

            try:
                content = KnowledgeArticleDraftUpdate(
                    title=incident.title,
                    problem_summary=incident.description,
                    solution_description=(
                        attempt.solution_description
                    ),
                    technical_actions=attempt.technical_actions,
                    recovery_evidence=attempt.recovery_evidence,
                )
            except ValidationError as error:
                raise KnowledgeArticleSourceError(
                    "La solución debe conservar una descripción, "
                    "acciones técnicas y evidencia válidas "
                    "para generar el borrador."
                ) from error

            article = KnowledgeArticle(
                source_incident_id=incident.id,
                source_attempt_id=attempt.id,
                title=content.title,
                problem_summary=content.problem_summary,
                solution_description=content.solution_description,
                technical_actions=content.technical_actions,
                recovery_evidence=content.recovery_evidence,
                status=KnowledgeArticleStatus.DRAFT,
                created_by_id=current_user.id,
            )

            self.repository.add(article)

            response = KnowledgeArticleResponse.model_validate(
                article
            )

            session.commit()

            return response

        except IntegrityError as error:
            session.rollback()

            mysql_error_code = (
                error.orig.args[0]
                if error.orig.args
                else None
            )

            if mysql_error_code == 1062:
                raise KnowledgeArticleAlreadyExistsError(
                    "Esta incidencia ya tiene un artículo "
                    "de conocimiento."
                ) from error

            raise

        except Exception:
            session.rollback()
            raise


    def list_articles(
        self,
        *,
        current_user: User,
        status: KnowledgeArticleStatus = (
            KnowledgeArticleStatus.PUBLISHED
        ),
        search: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> list[KnowledgeArticleSummary]:
        if not current_user.is_active or current_user.role not in (
            UserRole.TECHNICIAN,
            UserRole.IT_MANAGER,
        ):
            raise KnowledgeArticlePermissionError(
                "Se requiere una cuenta activa de técnico "
                "o responsable TI."
            )

        created_by_id: int | None = None

        if current_user.role == UserRole.TECHNICIAN:
            if status == KnowledgeArticleStatus.ARCHIVED:
                raise KnowledgeArticlePermissionError(
                    "Solo el responsable TI puede consultar "
                    "artículos archivados."
                )

            if status == KnowledgeArticleStatus.DRAFT:
                created_by_id = current_user.id

        articles = self.repository.list_summaries(
            status=status,
            created_by_id=created_by_id,
            search=search,
            offset=offset,
            limit=limit,
        )

        return [
            KnowledgeArticleSummary.model_validate(article)
            for article in articles
        ]


    def get_article(
        self,
        *,
        article_id: int,
        current_user: User,
    ) -> KnowledgeArticleResponse:
        if not current_user.is_active or current_user.role not in (
            UserRole.TECHNICIAN,
            UserRole.IT_MANAGER,
        ):
            raise KnowledgeArticlePermissionError(
                "Se requiere una cuenta activa de técnico "
                "o responsable TI."
            )

        article = self.repository.get_by_id(article_id)

        if article is None:
            raise KnowledgeArticleNotFoundError(
                "El artículo no está disponible."
            )

        is_manager = current_user.role == UserRole.IT_MANAGER
        is_published = (
            article.status == KnowledgeArticleStatus.PUBLISHED
        )
        is_own_draft = (
            article.status == KnowledgeArticleStatus.DRAFT
            and article.created_by_id == current_user.id
        )

        if not (is_manager or is_published or is_own_draft):
            raise KnowledgeArticleNotFoundError(
                "El artículo no está disponible."
            )

        return KnowledgeArticleResponse.model_validate(article)

    def update_draft(
        self,
        *,
        article_id: int,
        data: KnowledgeArticleDraftUpdate,
        current_user: User,
    ) -> KnowledgeArticleResponse:
        session = self.repository.session

        try:
            if (
                not current_user.is_active
                or current_user.role not in (
                    UserRole.TECHNICIAN,
                    UserRole.IT_MANAGER,
                )
            ):
                raise KnowledgeArticlePermissionError(
                    "Se requiere una cuenta activa de técnico "
                    "o responsable TI."
                )

            article = self.repository.get_by_id_for_update(
                article_id
            )

            if article is None:
                raise KnowledgeArticleNotFoundError(
                    "El artículo no está disponible."
                )

            is_manager = (
                current_user.role == UserRole.IT_MANAGER
            )

            if (
                not is_manager
                and article.created_by_id != current_user.id
            ):
                raise KnowledgeArticleNotFoundError(
                    "El artículo no está disponible."
                )

            if article.status != KnowledgeArticleStatus.DRAFT:
                raise KnowledgeArticleConflictError(
                    "Solo se pueden editar artículos "
                    "en estado borrador."
                )

            article.title = data.title
            article.problem_summary = data.problem_summary
            article.solution_description = (
                data.solution_description
            )
            article.technical_actions = data.technical_actions
            article.recovery_evidence = data.recovery_evidence
            article.updated_at = utc_now()

            session.flush()

            response = KnowledgeArticleResponse.model_validate(
                article
            )

            session.commit()

            return response

        except Exception:
            session.rollback()
            raise

    def publish_article(
        self,
        *,
        article_id: int,
        current_user: User,
    ) -> KnowledgeArticleResponse:
        session = self.repository.session

        try:
            if (
                not current_user.is_active
                or current_user.role != UserRole.IT_MANAGER
            ):
                raise KnowledgeArticlePermissionError(
                    "Solo el responsable TI puede publicar "
                    "artículos de conocimiento."
                )

            article = self.repository.get_by_id_for_update(
                article_id
            )

            if article is None:
                raise KnowledgeArticleNotFoundError(
                    "El artículo no está disponible."
                )

            if article.status != KnowledgeArticleStatus.DRAFT:
                raise KnowledgeArticleConflictError(
                    "Solo se pueden publicar artículos "
                    "en estado borrador."
                )

            try:
                KnowledgeArticleDraftUpdate(
                    title=article.title,
                    problem_summary=article.problem_summary,
                    solution_description=(
                        article.solution_description
                    ),
                    technical_actions=article.technical_actions,
                    recovery_evidence=article.recovery_evidence,
                )
            except ValidationError as error:
                raise KnowledgeArticleConflictError(
                    "Revisa el contenido del borrador antes "
                    "de publicarlo. Todos los campos deben "
                    "estar completos y ser válidos."
                ) from error

            published_at = utc_now()

            article.status = KnowledgeArticleStatus.PUBLISHED
            article.published_by_id = current_user.id
            article.published_at = published_at
            article.updated_at = published_at

            session.flush()

            response = KnowledgeArticleResponse.model_validate(
                article
            )

            session.commit()

            return response

        except Exception:
            session.rollback()
            raise