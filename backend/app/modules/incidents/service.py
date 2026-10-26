from sqlalchemy import select

from app.modules.incidents.models import (
    Incident,
    IncidentEvent,
    IncidentEventType,
    IncidentStatus,
    SolutionAttemptStatus,
    utc_now,
)
from app.modules.incidents.repository import IncidentRepository
from app.modules.incidents.schemas import (
    IncidentAssign,
    IncidentClassificationUpdate,
    IncidentCreate,
    IncidentEventResponse,
    IncidentResolve,
    IncidentResponse,
    IncidentReturn,
)
from app.modules.incidents.classification import calculate_priority
from app.modules.users.enums import UserRole
from app.modules.users.models import User
from app.modules.incidents.attempt_repository import (
    SolutionAttemptRepository,
)

from app.modules.notifications.models import (
    Notification,
    NotificationType,
)
from app.modules.notifications.repository import (
    NotificationRepository,
)


class IncidentNotFoundError(Exception):
    pass

class InvalidIncidentAssigneeError(Exception):
    pass

class IncidentAssignmentConflictError(Exception):
    pass

class IncidentStartConflictError(Exception):
    pass

class IncidentResolutionConflictError(Exception):
    pass

class IncidentClosureConflictError(Exception):
    pass

class IncidentReturnConflictError(Exception):
    pass

class IncidentClassificationPermissionError(Exception):
    pass

class IncidentClassificationConflictError(Exception):
    pass

class IncidentService:
    def __init__(self, repository: IncidentRepository) -> None:
        self.repository = repository

        self.attempt_repository = SolutionAttemptRepository(
            repository.session
        )

        self.notification_repository = NotificationRepository(
            repository.session
        )
    def start_incident(
        self,
        *,
        incident_id: int,
        assignee_id: int,
    ) -> IncidentResponse:
        session = self.repository.session

        try:
            incident = self.repository.get_by_id_for_update(
                incident_id,
            )

            if (
                incident is None
                or incident.assigned_to_id != assignee_id
            ):
                raise IncidentNotFoundError(
                    "La incidencia no está disponible."
                )

            if (
                incident.status != IncidentStatus.ASSIGNED
                or incident.started_at is not None
            ):
                raise IncidentStartConflictError(
                    "La incidencia ya fue iniciada "
                    "o no está en estado Asignada."
                )

            previous_status = incident.status
            started_at = utc_now()

            incident.status = IncidentStatus.IN_PROGRESS
            incident.started_at = started_at

            event = IncidentEvent(
                incident_id=incident.id,
                actor_id=assignee_id,
                event_type=IncidentEventType.STARTED,
                previous_status=previous_status,
                new_status=IncidentStatus.IN_PROGRESS,
                details="El técnico inició la atención.",
                created_at=started_at,
            )

            self.repository.add_event(event)

            response = IncidentResponse.model_validate(incident)

            session.commit()

            return response

        except Exception:
            session.rollback()
            raise

    def create_incident(
        self,
        data: IncidentCreate,
        reporter_id: int,
    ) -> IncidentResponse:
        session = self.repository.session

        incident = Incident(
            title=data.title,
            description=data.description,
            reporter_id=reporter_id,
            status=IncidentStatus.REPORTED,
        )

        try:
            self.repository.add(incident)

            event = IncidentEvent(
                incident_id=incident.id,
                actor_id=reporter_id,
                event_type=IncidentEventType.REPORTED,
                previous_status=None,
                new_status=IncidentStatus.REPORTED,
                details="Incidencia registrada por el reportante.",
                created_at=incident.created_at,
            )

            self.repository.add_event(event)

            response = IncidentResponse.model_validate(incident)

            session.commit()

            return response

        except Exception:
            session.rollback()
            raise


    def list_my_incidents(
        self,
        reporter_id: int,
        offset: int = 0,
        limit: int = 20,
    ) -> list[IncidentResponse]:
        self._validate_pagination(offset, limit)

        incidents = self.repository.list_by_reporter(
            reporter_id=reporter_id,
            offset=offset,
            limit=limit,
        )

        return [
            IncidentResponse.model_validate(incident)
            for incident in incidents
        ]

    def get_my_incident(
        self,
        incident_id: int,
        reporter_id: int,
    ) -> IncidentResponse:
        incident = self.repository.get_by_id(incident_id)

        if incident is None or incident.reporter_id != reporter_id:
            raise IncidentNotFoundError(
                "La incidencia no está disponible."
            )

        return IncidentResponse.model_validate(incident)

    def list_all_incidents(
        self,
        offset: int = 0,
        limit: int = 20,
    ) -> list[IncidentResponse]:
        self._validate_pagination(offset, limit)

        incidents = self.repository.list_all(
            offset=offset,
            limit=limit,
        )

        return [
            IncidentResponse.model_validate(incident)
            for incident in incidents
        ]

    def get_queue_incident(
        self,
        incident_id: int,
    ) -> IncidentResponse:
        incident = self.repository.get_by_id(incident_id)

        if incident is None:
            raise IncidentNotFoundError(
                "La incidencia no está disponible."
            )

        return IncidentResponse.model_validate(incident)


    def assign_incident(
        self,
        incident_id: int,
        data: IncidentAssign,
        assigned_by_id: int,
    ) -> IncidentResponse:
        session = self.repository.session

        try:
            incident = self.repository.get_by_id_for_update(
                incident_id,
            )

            if incident is None:
                raise IncidentNotFoundError(
                    "La incidencia no está disponible."
                )

            if (
                incident.status != IncidentStatus.REPORTED
                or incident.assigned_to_id is not None
                or incident.assigned_by_id is not None
                or incident.assigned_at is not None
            ):
                raise IncidentAssignmentConflictError(
                    "Solo se pueden asignar incidencias reportadas "
                    "que todavía no tengan una asignación."
                )

            assignee_statement = (
                select(User)
                .where(User.id == data.assigned_to_id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )

            assignee = session.scalar(assignee_statement)

            if (
                assignee is None
                or not assignee.is_active
                or assignee.role != UserRole.TECHNICIAN
            ):
                raise InvalidIncidentAssigneeError(
                    "Selecciona una cuenta activa con rol de técnico."
                )

            previous_status = incident.status
            assigned_at = utc_now()

            incident.assigned_to_id = assignee.id
            incident.assigned_by_id = assigned_by_id
            incident.assigned_at = assigned_at
            incident.status = IncidentStatus.ASSIGNED

            event = IncidentEvent(
                incident_id=incident.id,
                actor_id=assigned_by_id,
                event_type=IncidentEventType.ASSIGNED,
                previous_status=previous_status,
                new_status=IncidentStatus.ASSIGNED,
                details=(
                    "Incidencia asignada al técnico "
                    f"{assignee.full_name} (ID {assignee.id})."
                ),
                created_at=assigned_at,
            )

            self.repository.add_event(event)

            notification = Notification(
                recipient_id=assignee.id,
                incident_id=incident.id,
                source_event_id=event.id,
                notification_type=(
                    NotificationType.INCIDENT_ASSIGNED
                ),
                title="Nueva incidencia asignada",
                message=(
                    f"Se te asignó la incidencia #{incident.id}: "
                    f"{incident.title}"
                ),
                created_at=assigned_at,
                read_at=None,
            )

            self.notification_repository.add(notification)

            response = IncidentResponse.model_validate(
                incident
            )

            session.commit()

            return response

        except Exception:
            session.rollback()
            raise

    def list_my_assignments(
        self,
        assignee_id: int,
        offset: int = 0,
        limit: int = 20,
    ) -> list[IncidentResponse]:
        self._validate_pagination(offset, limit)

        incidents = self.repository.list_by_assignee(
            assignee_id=assignee_id,
            offset=offset,
            limit=limit,
        )

        return [
            IncidentResponse.model_validate(incident)
            for incident in incidents
        ]

    def get_my_assignment(
        self,
        incident_id: int,
        assignee_id: int,
    ) -> IncidentResponse:
        incident = self.repository.get_by_id(incident_id)

        if (
            incident is None
            or incident.assigned_to_id != assignee_id
        ):
            raise IncidentNotFoundError(
                "La incidencia no está disponible."
            )

        return IncidentResponse.model_validate(incident)


    def resolve_incident(
        self,
        *,
        incident_id: int,
        assignee_id: int,
        data: IncidentResolve,
    ) -> IncidentResponse:
        session = self.repository.session

        try:
            incident = self.repository.get_by_id_for_update(
                incident_id
            )

            if (
                incident is None
                or incident.assigned_to_id != assignee_id
            ):
                raise IncidentNotFoundError(
                    "La incidencia no está disponible."
                )

            if (
                incident.status != IncidentStatus.IN_PROGRESS
                or incident.started_at is None
                or incident.resolved_at is not None
                or incident.resolution_summary is not None
                or incident.closed_at is not None
            ):
                raise IncidentResolutionConflictError(
                    "Solo se pueden resolver incidencias "
                    "en atención que todavía no tengan "
                    "una solución registrada."
                )

            latest_attempt = (
                self.attempt_repository.get_latest_for_update(
                    incident_id
                )
            )

            if latest_attempt is not None:
                raise IncidentResolutionConflictError(
                    "Esta incidencia tiene intentos registrados. "
                    "Finaliza el intento con recuperación, "
                    "acciones técnicas y evidencia."
                )

            previous_status = incident.status
            resolved_at = utc_now()

            incident.resolution_summary = data.resolution_summary
            incident.resolved_at = resolved_at
            incident.status = IncidentStatus.PENDING_CONFIRMATION

            event = IncidentEvent(
                incident_id=incident.id,
                actor_id=assignee_id,
                event_type=IncidentEventType.RESOLVED,
                previous_status=previous_status,
                new_status=IncidentStatus.PENDING_CONFIRMATION,
                details=data.resolution_summary,
                created_at=resolved_at,
            )

            self.repository.add_event(event)

            notification = Notification(
                recipient_id=incident.reporter_id,
                incident_id=incident.id,
                source_event_id=event.id,
                notification_type=(
                    NotificationType.INCIDENT_RESOLVED
                ),
                title="Solución pendiente de confirmación",
                message=(
                    f"Se registró una solución para la incidencia "
                    f"#{incident.id}: {incident.title}. "
                    "Revisa el detalle y confirma si el servicio "
                    "funciona correctamente o devuelve la solución "
                    "indicando el motivo."
                ),
                created_at=resolved_at,
                read_at=None,
            )

            self.notification_repository.add(notification)

            session.flush()

            response = IncidentResponse.model_validate(incident)

            session.commit()

            return response

        except Exception:
            session.rollback()
            raise

    def close_incident(
        self,
        *,
        incident_id: int,
        reporter_id: int,
    ) -> IncidentResponse:
        session = self.repository.session

        try:
            incident = self.repository.get_by_id_for_update(
                incident_id,
            )

            if (
                incident is None
                or incident.reporter_id != reporter_id
            ):
                raise IncidentNotFoundError(
                    "La incidencia no está disponible."
                )

            if (
                incident.status
                != IncidentStatus.PENDING_CONFIRMATION
                or incident.resolved_at is None
                or not incident.resolution_summary
                or incident.closed_at is not None
            ):
                raise IncidentClosureConflictError(
                    "Solo se pueden cerrar incidencias "
                    "resueltas y pendientes de confirmación."
                )

            previous_status = incident.status
            closed_at = utc_now()

            incident.status = IncidentStatus.CLOSED
            incident.closed_at = closed_at

            event = IncidentEvent(
                incident_id=incident.id,
                actor_id=reporter_id,
                event_type=IncidentEventType.CLOSED,
                previous_status=previous_status,
                new_status=IncidentStatus.CLOSED,
                details=(
                    "El reportante confirmó la recuperación "
                    "del servicio y el cierre de la incidencia."
                ),
                created_at=closed_at,
            )

            self.repository.add_event(event)
            session.flush()

            response = IncidentResponse.model_validate(incident)

            session.commit()

            return response

        except Exception:
            session.rollback()
            raise    


    def list_incident_events(
        self,
        *,
        incident_id: int,
        current_user: User,
        offset: int = 0,
        limit: int = 20,
    ) -> list[IncidentEventResponse]:
        self._validate_pagination(offset, limit)

        incident = self.repository.get_by_id(incident_id)

        if incident is None:
            raise IncidentNotFoundError(
                "La incidencia no está disponible."
            )

        is_reporter = incident.reporter_id == current_user.id

        is_assigned_technician = (
            current_user.role == UserRole.TECHNICIAN
            and incident.assigned_to_id == current_user.id
        )

        is_it_manager = (
            current_user.role == UserRole.IT_MANAGER
        )

        if not (
            is_reporter
            or is_assigned_technician
            or is_it_manager
        ):
            raise IncidentNotFoundError(
                "La incidencia no está disponible."
            )

        events = self.repository.list_events(
            incident_id=incident_id,
            offset=offset,
            limit=limit,
        )

        return [
            IncidentEventResponse.model_validate(event)
            for event in events
        ]

    def return_incident(
        self,
        *,
        incident_id: int,
        reporter_id: int,
        data: IncidentReturn,
    ) -> IncidentResponse:
        session = self.repository.session

        try:
            incident = self.repository.get_by_id_for_update(
                incident_id
            )

            if (
                incident is None
                or incident.reporter_id != reporter_id
            ):
                raise IncidentNotFoundError(
                    "La incidencia no está disponible."
                )

            if (
                incident.status
                != IncidentStatus.PENDING_CONFIRMATION
                or incident.assigned_to_id is None
                or incident.started_at is None
                or incident.resolved_at is None
                or not incident.resolution_summary
                or incident.closed_at is not None
            ):
                raise IncidentReturnConflictError(
                    "Solo se pueden devolver incidencias "
                    "resueltas y pendientes de confirmación "
                    "que conserven su asignación y solución."
                )

            latest_attempt = (
                self.attempt_repository.get_latest_for_update(
                    incident_id
                )
            )

            previous_status = incident.status
            previous_summary = incident.resolution_summary
            previous_resolved_at = incident.resolved_at
            returned_at = utc_now()

            if returned_at < previous_resolved_at:
                raise IncidentReturnConflictError(
                    "La fecha de devolución es anterior "
                    "a la recuperación. Revisa la hora del servidor."
                )

            if latest_attempt is not None:
                if (
                    latest_attempt.status
                    != SolutionAttemptStatus.RECOVERED
                    or latest_attempt.finished_at is None
                    or latest_attempt.finished_at
                    != previous_resolved_at
                    or latest_attempt.technician_id
                    != incident.assigned_to_id
                    or latest_attempt.returned_at is not None
                ):
                    raise IncidentReturnConflictError(
                        "El último intento no coincide con "
                        "la recuperación pendiente de confirmación."
                    )

                latest_attempt.status = (
                    SolutionAttemptStatus.RETURNED
                )
                latest_attempt.returned_at = returned_at
                latest_attempt.return_reason = data.reason

            event = IncidentEvent(
                incident_id=incident.id,
                actor_id=reporter_id,
                event_type=IncidentEventType.RETURNED,
                previous_status=previous_status,
                new_status=IncidentStatus.IN_PROGRESS,
                details=(
                    f"Motivo de devolución: {data.reason}\n\n"
                    "Solución registrada antes de la devolución:\n"
                    f"{previous_summary}\n\n"
                    "Fecha de recuperación registrada previamente "
                    f"(UTC): {previous_resolved_at.isoformat()}"
                ),
                created_at=returned_at,
            )

            incident.status = IncidentStatus.IN_PROGRESS
            incident.resolution_summary = None
            incident.resolved_at = None

            self.repository.add_event(event)
            session.flush()

            response = IncidentResponse.model_validate(incident)

            session.commit()

            return response

        except Exception:
            session.rollback()
            raise

    def classify_incident(
        self,
        *,
        incident_id: int,
        data: IncidentClassificationUpdate,
        current_user: User,
    ) -> IncidentResponse:
        session = self.repository.session

        impact_labels = {
            "high": "Alto",
            "medium": "Medio",
            "low": "Bajo",
        }

        urgency_labels = {
            "high": "Alta",
            "medium": "Media",
            "low": "Baja",
        }

        try:
            if (
                not current_user.is_active
                or current_user.role != UserRole.IT_MANAGER
            ):
                raise IncidentClassificationPermissionError(
                    "Solo el responsable TI puede clasificar incidencias."
                )

            incident = self.repository.get_by_id_for_update(
                incident_id,
            )

            if incident is None:
                raise IncidentNotFoundError(
                    "La incidencia no está disponible."
                )

            if (
                incident.status not in (
                    IncidentStatus.REPORTED,
                    IncidentStatus.ASSIGNED,
                    IncidentStatus.IN_PROGRESS,
                )
                or incident.resolved_at is not None
                or incident.closed_at is not None
            ):
                raise IncidentClassificationConflictError(
                    "Solo se pueden clasificar incidencias "
                    "reportadas, asignadas o en atención."
                )

            previous_category = (
                incident.category.value
                if incident.category is not None
                else "Sin clasificar"
            )

            previous_impact = (
                impact_labels[incident.impact.value]
                if incident.impact is not None
                else "Sin evaluar"
            )

            previous_urgency = (
                urgency_labels[incident.urgency.value]
                if incident.urgency is not None
                else "Sin evaluar"
            )

            previous_priority = (
                incident.priority.value.upper()
                if incident.priority is not None
                else "Sin determinar"
            )

            classified_at = utc_now()

            priority = calculate_priority(
                data.impact,
                data.urgency,
            )

            incident.category = data.category
            incident.impact = data.impact
            incident.urgency = data.urgency
            incident.priority = priority
            incident.classified_by_id = current_user.id
            incident.classified_at = classified_at

            event = IncidentEvent(
                incident_id=incident.id,
                actor_id=current_user.id,
                event_type=IncidentEventType.CLASSIFIED,
                previous_status=incident.status,
                new_status=incident.status,
                details=(
                    "Clasificación anterior:\n"
                    f"Categoría: {previous_category}\n"
                    f"Impacto: {previous_impact}\n"
                    f"Urgencia: {previous_urgency}\n"
                    f"Prioridad: {previous_priority}\n\n"
                    "Clasificación registrada:\n"
                    f"Categoría: {data.category.value}\n"
                    f"Impacto: {impact_labels[data.impact.value]}\n"
                    f"Urgencia: {urgency_labels[data.urgency.value]}\n"
                    f"Prioridad: {priority.value.upper()}"
                ),
                created_at=classified_at,
            )

            self.repository.add_event(event)
            session.flush()

            response = IncidentResponse.model_validate(incident)

            session.commit()

            return response

        except Exception:
            session.rollback()
            raise
            
    @staticmethod
    def _validate_pagination(offset: int, limit: int) -> None:
        if offset < 0:
            raise ValueError(
                "El desplazamiento no puede ser negativo."
            )

        if not 1 <= limit <= 100:
            raise ValueError(
                "El límite debe estar entre 1 y 100."
            ) 