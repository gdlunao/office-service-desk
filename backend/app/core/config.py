from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    db_host: str = "127.0.0.1"
    db_port: int = 3306
    db_name: str = "office_service_desk"
    db_user: str
    db_password: SecretStr

    jwt_secret_key: SecretStr = Field(min_length=64)

    access_token_expire_minutes: int = Field(
        default=30,
        ge=1,
        le=60,
    )

    attachments_storage_dir: Path = (
        BACKEND_DIR / "storage" / "attachments"
    )

    attachments_max_files_per_incident: int = Field(
        default=5,
        ge=1,
        le=50,
    )

    attachments_max_file_size_mb: int = Field(
        default=10,
        ge=1,
        le=50,
    )

    ai_enabled: bool = False

    gemini_api_key: SecretStr | None = Field(
        default=None,
        repr=False,
    )

    gemini_model: str = Field(
        default="",
        max_length=100,
    )

    ai_timeout_seconds: float = Field(
        default=20.0,
        ge=5.0,
        le=60.0,
    )

    @property
    def attachments_max_file_size_bytes(self) -> int:
        return self.attachments_max_file_size_mb * 1024 * 1024

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()