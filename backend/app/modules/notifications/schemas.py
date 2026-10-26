from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.modules.notifications.models import NotificationType


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    incident_id: int
    notification_type: NotificationType
    title: str
    message: str
    created_at: datetime
    read_at: datetime | None


class NotificationUnreadCountResponse(BaseModel):
    unread_count: int = Field(ge=0)