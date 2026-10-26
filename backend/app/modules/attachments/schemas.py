from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AttachmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    incident_id: int
    uploaded_by_id: int
    original_filename: str
    content_type: str
    file_size_bytes: int
    created_at: datetime