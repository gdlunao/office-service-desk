from contextlib import suppress
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from uuid import uuid4
import re


STORAGE_KEY_PATTERN = re.compile(r"[0-9a-f]{32}")


@dataclass(frozen=True)
class StoredAttachment:
    storage_key: str
    sha256: str
    file_size_bytes: int


class LocalAttachmentStorage:
    def __init__(self, root_dir: Path) -> None:
        self.root_dir = root_dir.resolve()

    def save(self, content: bytes) -> StoredAttachment:
        """Guarda contenido previamente validado."""
        if not content:
            raise ValueError("No se puede guardar un archivo vacío.")

        self.root_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        storage_key = uuid4().hex
        destination = self._path_for_key(storage_key)
        created = False

        try:
            with destination.open("xb") as file:
                created = True
                file.write(content)

            return StoredAttachment(
                storage_key=storage_key,
                sha256=sha256(content).hexdigest(),
                file_size_bytes=len(content),
            )

        except Exception:
            if created:
                with suppress(OSError):
                    destination.unlink(missing_ok=True)
            raise

    def get_path(self, storage_key: str) -> Path:
        path = self._path_for_key(storage_key)

        if not path.is_file():
            raise FileNotFoundError(
                "El archivo no está disponible en el almacenamiento."
            )

        return path

    def delete(self, storage_key: str) -> None:
        """Permite limpiar archivos si falla su registro en MySQL."""
        path = self._path_for_key(storage_key)
        path.unlink(missing_ok=True)

    def _path_for_key(self, storage_key: str) -> Path:
        if STORAGE_KEY_PATTERN.fullmatch(storage_key) is None:
            raise ValueError(
                "El identificador de almacenamiento no es válido."
            )

        return self.root_dir / storage_key