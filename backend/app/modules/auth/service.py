from secrets import token_urlsafe

from app.core.security import hash_password, verify_password
from app.modules.auth.schemas import TokenResponse
from app.modules.auth.tokens import create_access_token
from app.modules.users.repository import UserRepository


DUMMY_PASSWORD_HASH = hash_password(token_urlsafe(32))


class InvalidCredentialsError(Exception):
    pass


class AuthService:
    def __init__(self, repository: UserRepository) -> None:
        self.repository = repository

    def login(
        self,
        *,
        email: str,
        password: str,
    ) -> TokenResponse:
        user = self.repository.get_by_email(email.strip())

        stored_hash = (
            user.password_hash
            if user is not None
            else DUMMY_PASSWORD_HASH
        )

        password_matches = verify_password(
            password,
            stored_hash,
        )

        if (
            user is None
            or not password_matches
            or not user.is_active
        ):
            raise InvalidCredentialsError(
                "Correo o contrasena incorrectos."
            )

        return TokenResponse(
            access_token=create_access_token(user.id),
        )