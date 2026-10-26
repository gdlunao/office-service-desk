from collections.abc import Iterator

from sqlalchemy import URL, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

database_url = URL.create(
    drivername="mysql+pymysql",
    username=settings.db_user,
    password=settings.db_password.get_secret_value(),
    host=settings.db_host,
    port=settings.db_port,
    database=settings.db_name,
    query={"charset": "utf8mb4"},
)

engine = create_engine(
    database_url,
    pool_pre_ping=True,
    connect_args={
        "connect_timeout": 5,
        "read_timeout": 5,
        "write_timeout": 5,
    },
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
)


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session