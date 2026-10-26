from fastapi import FastAPI

from app.modules.auth.router import router as auth_router
from app.modules.users.router import router as users_router
from app.modules.incidents.router import router as incidents_router
from app.modules.attachments.router import router as attachments_router
from app.modules.reports.router import router as reports_router
from app.modules.knowledge.router import router as knowledge_router
from app.modules.incidents.attempt_router import (
    router as solution_attempts_router,
)
from app.modules.incidents.attempt_router import (
    query_router as solution_attempt_queries_router,
)
from app.modules.knowledge.recommendation_router import (
    router as knowledge_recommendations_router,
)
from app.modules.notifications.router import (
    router as notifications_router,
)
app = FastAPI(
    title="Office Service Desk API",
    description="API para el proceso de incidencias TI.",
    version="0.1.0",
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(incidents_router, prefix="/api/v1")
app.include_router(attachments_router, prefix="/api/v1")
app.include_router(solution_attempts_router,prefix="/api/v1",)
app.include_router(solution_attempt_queries_router,prefix="/api/v1",)
app.include_router(reports_router,prefix="/api/v1",)
app.include_router(knowledge_router,prefix="/api/v1",)
app.include_router(knowledge_recommendations_router,prefix="/api/v1",)
app.include_router(notifications_router,prefix="/api/v1",)
@app.get("/health", tags=["Health"])
def check_health() -> dict[str, str]:
    return {"status": "ok"}

