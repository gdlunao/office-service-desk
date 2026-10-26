from sqlalchemy.exc import IntegrityError

from app.core.security import hash_password
from app.modules.users.repository import UserRepository
from app.modules.users.schemas import (
    TechnicianOptionResponse,
    UserCreate,
    UserResponse,
    UserRoleUpdate,
)


class UserEmailAlreadyExistsError(Exception):
    pass


class UserNotFoundError(Exception):
    pass


class UserService:
    def __init__(self, repository: UserRepository) -> None:
        self.repository = repository
    
    def list_active_technicians(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
    ) -> list[TechnicianOptionResponse]:
        if offset < 0:
            raise ValueError(
                "El desplazamiento no puede ser negativo."
            )

        if not 1 <= limit <= 100:
            raise ValueError(
                "El límite debe estar entre 1 y 100."
            )

        technicians = self.repository.list_active_technicians(
            offset=offset,
            limit=limit,
        )

        return [
            TechnicianOptionResponse.model_validate(technician)
            for technician in technicians
        ]

    def list_users(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
    ) -> list[UserResponse]:
        if offset < 0:
            raise ValueError("El desplazamiento no puede ser negativo.")

        if not 1 <= limit <= 100:
            raise ValueError("El límite debe estar entre 1 y 100.")

        users = self.repository.list_users(
            offset=offset,
            limit=limit,
        )

        return [
            UserResponse.model_validate(user)
            for user in users
        ]

    def create_user(self, data: UserCreate) -> UserResponse:
        session = self.repository.session

        try:
            existing_user = self.repository.get_by_email(
                str(data.email)
            )

            if existing_user is not None:
                raise UserEmailAlreadyExistsError(
                    "Ya existe una cuenta con ese correo."
                )

            stored_hash = hash_password(
                data.password.get_secret_value()
            )

            user = self.repository.add(
                full_name=data.full_name,
                email=str(data.email),
                password_hash=stored_hash,
            )

            response = UserResponse.model_validate(user)

            session.commit()

            return response

        except IntegrityError as error:
            session.rollback()

            mysql_error_code = (
                error.orig.args[0]
                if error.orig.args
                else None
            )

            if mysql_error_code == 1062:
                raise UserEmailAlreadyExistsError(
                    "Ya existe una cuenta con ese correo."
                ) from error

            raise

        except Exception:
            session.rollback()
            raise

    def update_role(
        self,
        *,
        user_id: int,
        data: UserRoleUpdate,
    ) -> UserResponse:
        session = self.repository.session

        try:
            user = self.repository.get_by_id(user_id)

            if user is None:
                raise UserNotFoundError(
                    "El usuario no existe."
                )

            user.role = data.role

            session.flush()

            response = UserResponse.model_validate(user)

            session.commit()

            return response

        except Exception:
            session.rollback()
            raise