from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.users.enums import UserRole
from app.modules.users.models import User


class UserRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_by_id(self, user_id: int) -> User | None:
        return self.session.get(User, user_id)

    def get_by_email(self, email: str) -> User | None:
        statement = select(User).where(User.email == email)
        return self.session.scalar(statement)

    def list_users(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
    ) -> list[User]:
        statement = (
            select(User)
            .order_by(User.id)
            .offset(offset)
            .limit(limit)
        )

        return list(self.session.scalars(statement).all())

    def list_active_technicians(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
    ) -> list[User]:
        statement = (
            select(User)
            .where(
                User.is_active.is_(True),
                User.role == UserRole.TECHNICIAN,
            )
            .order_by(User.full_name, User.id)
            .offset(offset)
            .limit(limit)
        )

        return list(self.session.scalars(statement).all())

    def add(
        self,
        *,
        full_name: str,
        email: str,
        password_hash: str,
    ) -> User:
        user = User(
            full_name=full_name,
            email=email,
            password_hash=password_hash,
        )

        self.session.add(user)
        self.session.flush()

        return user