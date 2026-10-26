from datetime import datetime, timedelta, timezone

import jwt
from jwt.exceptions import InvalidTokenError

from app.core.config import get_settings

ALGORITHM = "HS256"
ISSUER = "office-service-desk"
AUDIENCE = "office-service-desk-api"


def create_access_token(user_id: int) -> str:
    if type(user_id) is not int or user_id <= 0:
        raise ValueError("El identificador debe ser un entero positivo.")

    settings = get_settings()
    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(
            minutes=settings.access_token_expire_minutes
        ),
        "iss": ISSUER,
        "aud": AUDIENCE,
        "token_type": "access",
    }

    return jwt.encode(
        payload,
        settings.jwt_secret_key.get_secret_value(),
        algorithm=ALGORITHM,
    )


def decode_access_token(token: str) -> int:
    settings = get_settings()

    payload = jwt.decode(
        token,
        settings.jwt_secret_key.get_secret_value(),
        algorithms=[ALGORITHM],
        issuer=ISSUER,
        audience=AUDIENCE,
        options={
            "require": [
                "sub",
                "iat",
                "exp",
                "iss",
                "aud",
                "token_type",
            ],
        },
    )

    if payload["token_type"] != "access":
        raise InvalidTokenError("Tipo de token invalido.")

    subject = payload["sub"]

    try:
        user_id = int(subject)
    except (TypeError, ValueError) as error:
        raise InvalidTokenError("Identificador invalido.") from error

    if user_id <= 0 or str(user_id) != subject:
        raise InvalidTokenError("Identificador invalido.")

    return user_id