from datetime import date
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.incidents.dependencies import require_it_manager
from app.modules.reports.repository import ReportRepository
from app.modules.reports.schemas import IncidentIndicatorsResponse
from app.modules.reports.service import (
    InvalidReportPeriodError,
    ReportService,
)


router = APIRouter(
    prefix="/reports",
    tags=["Reports"],
    dependencies=[Depends(require_it_manager)],
)


def get_report_service(
    session: Annotated[Session, Depends(get_db)],
) -> ReportService:
    return ReportService(ReportRepository(session))


@router.get(
    "/incident-indicators",
    response_model=IncidentIndicatorsResponse,
)
def get_incident_indicators(
    service: Annotated[
        ReportService,
        Depends(get_report_service),
    ],
    period_start: Annotated[
        date | None,
        Query(
            description=(
                "Fecha inicial de recuperación en hora de Perú. "
                "Formato: YYYY-MM-DD."
            ),
        ),
    ] = None,
    period_end: Annotated[
        date | None,
        Query(
            description=(
                "Fecha final de recuperación, inclusive, "
                "en hora de Perú. Formato: YYYY-MM-DD."
            ),
        ),
    ] = None,
) -> IncidentIndicatorsResponse:
    try:
        return service.get_incident_indicators(
            period_start=period_start,
            period_end=period_end,
        )
    except InvalidReportPeriodError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error