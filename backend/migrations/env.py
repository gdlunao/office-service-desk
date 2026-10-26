from logging.config import fileConfig

from alembic import context
from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL, create_engine, pool
from app.modules.knowledge.models import KnowledgeArticle
from app.core.base import Base
from app.core.config import BACKEND_DIR, get_settings
from app.modules.users.models import User
from app.modules.incidents.models import Incident
from app.modules.attachments.models import IncidentAttachment
from app.modules.notifications.models import Notification

class MigrationSettings(BaseSettings):
    migration_db_user: str
    migration_db_password: SecretStr

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

settings = get_settings()
migration_settings = MigrationSettings()

database_url = URL.create(
    drivername="mysql+pymysql",
    username=migration_settings.migration_db_user,
    password=migration_settings.migration_db_password.get_secret_value(),
    host=settings.db_host,
    port=settings.db_port,
    database=settings.db_name,
    query={"charset": "utf8mb4"},
)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    migration_engine = create_engine(
        database_url,
        poolclass=pool.NullPool,
        connect_args={
            "connect_timeout": 5,
            "read_timeout": 5,
            "write_timeout": 5,
        },
    )

    try:
        with migration_engine.connect() as connection:
            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                compare_type=True,
            )

            with context.begin_transaction():
                context.run_migrations()
    finally:
        migration_engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()