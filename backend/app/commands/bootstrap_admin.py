from getpass import getpass

from pydantic import ValidationError
from sqlalchemy import select

from app.core.database import SessionLocal, engine
from app.core.security import hash_password
from app.modules.users.models import User
from app.modules.users.repository import UserRepository
from app.modules.users.schemas import UserCreate


def main() -> None:
    try:
        with SessionLocal() as session:
            existing_admin = session.scalar(
                select(User.id)
                .where(User.is_admin.is_(True))
                .limit(1)
            )

            if existing_admin is not None:
                print("Ya existe un administrador. No se realizaron cambios.")
                return

            full_name = input("Nombre del administrador: ")
            email = input("Correo del administrador: ").strip()
            password = getpass("Contrasena: ")
            confirmation = getpass("Repetir contrasena: ")

            if password != confirmation:
                print("Las contrasenas no coinciden. No se creo la cuenta.")
                return

            try:
                data = UserCreate(
                    full_name=full_name,
                    email=email,
                    password=password,
                )
            except ValidationError:
                print(
                    "Datos invalidos. Revisa el nombre, el correo "
                    "y la contrasena de 15 a 128 caracteres."
                )
                return

            repository = UserRepository(session)

            if repository.get_by_email(str(data.email)) is not None:
                print("El correo ya pertenece a una cuenta.")
                return

            try:
                user = repository.add(
                    full_name=data.full_name,
                    email=str(data.email),
                    password_hash=hash_password(
                        data.password.get_secret_value()
                    ),
                )

                user.is_admin = True
                session.flush()
                admin_id = user.id
                session.commit()

            except Exception:
                session.rollback()
                raise

            print("Administrador inicial creado: OK")
            print("ID:", admin_id)

    finally:
        engine.dispose()


if __name__ == "__main__":
    main()