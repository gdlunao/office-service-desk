from collections.abc import Mapping
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from app.modules.incidents.models import SolutionAttemptStatus
from app.modules.reports.repository import ReportRepository
from app.modules.reports.schemas import (
    IncidentIndicatorsResponse,
    PercentageIndicator,
    ResolutionTimeIndicator,
)


REPORT_TIMEZONE = timezone(timedelta(hours=-5))


class InvalidReportPeriodError(ValueError):
    pass


class ReportService:
    def __init__(self, repository: ReportRepository) -> None:
        self.repository = repository

    def get_incident_indicators(
        self,
        *,
        period_start: date | None = None,
        period_end: date | None = None,
    ) -> IncidentIndicatorsResponse:
        if (
            period_start is not None
            and period_end is not None
            and period_start > period_end
        ):
            raise InvalidReportPeriodError(
                "La fecha inicial no puede ser posterior "
                "a la fecha final."
            )

        if period_end == date.max:
            raise InvalidReportPeriodError(
                "La fecha final está fuera del rango permitido."
            )

        recovered_from = (
            self._start_of_day_utc(period_start)
            if period_start is not None
            else None
        )

        recovered_before = (
            self._start_of_day_utc(
                period_end + timedelta(days=1)
            )
            if period_end is not None
            else None
        )

        total_resolved = 0

        time_evaluated = 0
        total_minutes = 0.0

        first_solution_evaluated = 0
        first_solution_matches = 0

        documentation_evaluated = 0
        documentation_matches = 0

        rows = self.repository.iter_resolved_incidents(
            recovered_from=recovered_from,
            recovered_before=recovered_before,
        )

        for row in rows:
            total_resolved += 1

            if not self._has_verified_recovery(row):
                continue

            resolved_at = row["resolved_at"]
            first_started_at = row["first_attempt_started_at"]
            attention_started_at = row["attention_started_at"]

            # I1: desde el inicio de la primera solución hasta
            # la recuperación actual, sin usar la fecha de cierre.
            if (
                isinstance(first_started_at, datetime)
                and isinstance(attention_started_at, datetime)
                and attention_started_at
                <= first_started_at
                <= resolved_at
            ):
                minutes = (
                    resolved_at - first_started_at
                ).total_seconds() / 60

                total_minutes += minutes
                time_evaluated += 1

            # I2: una recuperación devuelta no cuenta como
            # recuperación efectiva con la primera solución.
            first_status = row["first_attempt_status"]
            first_finished_at = row["first_attempt_finished_at"]

            first_result_verified = (
                isinstance(first_started_at, datetime)
                and isinstance(first_finished_at, datetime)
                and first_started_at
                <= first_finished_at
                <= resolved_at
            )

            if first_result_verified:
                if first_status in (
                    SolutionAttemptStatus.FAILED,
                    SolutionAttemptStatus.RETURNED,
                ):
                    first_solution_evaluated += 1

                elif (
                    first_status
                    == SolutionAttemptStatus.RECOVERED
                    and row["attempt_count"] == 1
                    and row["latest_attempt_number"] == 1
                ):
                    first_solution_evaluated += 1
                    first_solution_matches += 1

            # I3: se revisa la documentación de la solución
            # que produjo la recuperación actual.
            documentation_evaluated += 1

            if all(
                self._has_text(row[field])
                for field in (
                    "latest_solution_description",
                    "latest_technical_actions",
                    "latest_recovery_evidence",
                )
            ):
                documentation_matches += 1

        return IncidentIndicatorsResponse(
            period_start=period_start,
            period_end=period_end,
            resolved_incidents=total_resolved,
            resolution_time=ResolutionTimeIndicator(
                evaluated_incidents=time_evaluated,
                excluded_incidents=(
                    total_resolved - time_evaluated
                ),
                average_minutes=(
                    round(total_minutes / time_evaluated, 2)
                    if time_evaluated > 0
                    else None
                ),
            ),
            first_solution_recovery=PercentageIndicator(
                evaluated_incidents=first_solution_evaluated,
                excluded_incidents=(
                    total_resolved - first_solution_evaluated
                ),
                matching_incidents=first_solution_matches,
                percentage=self._percentage(
                    first_solution_matches,
                    first_solution_evaluated,
                ),
            ),
            complete_documentation=PercentageIndicator(
                evaluated_incidents=documentation_evaluated,
                excluded_incidents=(
                    total_resolved - documentation_evaluated
                ),
                matching_incidents=documentation_matches,
                percentage=self._percentage(
                    documentation_matches,
                    documentation_evaluated,
                ),
            ),
        )

    @staticmethod
    def _has_verified_recovery(
        row: Mapping[str, Any],
    ) -> bool:
        resolved_at = row["resolved_at"]
        latest_finished_at = row["latest_attempt_finished_at"]

        return (
            isinstance(resolved_at, datetime)
            and isinstance(latest_finished_at, datetime)
            and row["attempt_count"] > 0
            and row["latest_attempt_number"]
            == row["attempt_count"]
            and row["latest_attempt_status"]
            == SolutionAttemptStatus.RECOVERED
            and latest_finished_at == resolved_at
            and row["latest_attempt_returned_at"] is None
        )

    @staticmethod
    def _has_text(value: object) -> bool:
        return (
            isinstance(value, str)
            and bool(value.strip())
        )

    @staticmethod
    def _percentage(
        matching: int,
        evaluated: int,
    ) -> float | None:
        if evaluated == 0:
            return None

        return round(matching * 100 / evaluated, 2)

    @staticmethod
    def _start_of_day_utc(value: date) -> datetime:
        local_datetime = datetime.combine(
            value,
            time.min,
            tzinfo=REPORT_TIMEZONE,
        )

        return local_datetime.astimezone(
            timezone.utc
        ).replace(tzinfo=None)