import warnings
from dataclasses import dataclass
from io import BytesIO
from pathlib import PurePosixPath

from PIL import Image, UnidentifiedImageError
from pypdf import PdfReader
from pypdf.errors import PyPdfError


MAX_IMAGE_PIXELS = 20_000_000
MAX_PDF_PAGES = 200

ALLOWED_EXTENSIONS = {
    ".png": ("image/png", "PNG"),
    ".jpg": ("image/jpeg", "JPEG"),
    ".jpeg": ("image/jpeg", "JPEG"),
    ".pdf": ("application/pdf", None),
}


class InvalidAttachmentError(Exception):
    pass


@dataclass(frozen=True)
class ValidatedAttachment:
    original_filename: str
    content_type: str
    file_size_bytes: int


def validate_attachment(
    *,
    filename: str,
    content: bytes,
    max_size_bytes: int,
) -> ValidatedAttachment:
    if max_size_bytes <= 0:
        raise ValueError("El límite de tamaño debe ser positivo.")

    if not content:
        raise InvalidAttachmentError(
            "El archivo está vacío."
        )

    if len(content) > max_size_bytes:
        raise InvalidAttachmentError(
            "El archivo supera el tamaño máximo permitido."
        )

    cleaned_filename = filename.strip()

    if (
        not cleaned_filename
        or len(cleaned_filename) > 255
        or "/" in cleaned_filename
        or "\\" in cleaned_filename
        or any(ord(character) < 32 for character in cleaned_filename)
        or any(
            character in '<>:"|?*'
            for character in cleaned_filename
        )
    ):
        raise InvalidAttachmentError(
            "El nombre del archivo no es válido."
        )

    extension = PurePosixPath(cleaned_filename).suffix.lower()
    file_format = ALLOWED_EXTENSIONS.get(extension)

    if file_format is None:
        raise InvalidAttachmentError(
            "Solo se permiten archivos PNG, JPEG y PDF."
        )

    content_type, image_format = file_format

    if image_format is not None:
        _validate_image(content, image_format)
    else:
        _validate_pdf(content)

    return ValidatedAttachment(
        original_filename=cleaned_filename,
        content_type=content_type,
        file_size_bytes=len(content),
    )


def _validate_image(content: bytes, expected_format: str) -> None:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter(
                "error",
                Image.DecompressionBombWarning,
            )

            with Image.open(BytesIO(content)) as image:
                if image.format != expected_format:
                    raise InvalidAttachmentError(
                        "La extensión no corresponde al contenido."
                    )

                if image.width * image.height > MAX_IMAGE_PIXELS:
                    raise InvalidAttachmentError(
                        "La imagen supera los 20 megapíxeles permitidos."
                    )

                image.verify()

            with Image.open(BytesIO(content)) as image:
                image.load()

    except (
        UnidentifiedImageError,
        OSError,
        SyntaxError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as error:
        raise InvalidAttachmentError(
            "La imagen está dañada o no se puede procesar."
        ) from error


def _validate_pdf(content: bytes) -> None:
    if not content.startswith(b"%PDF-"):
        raise InvalidAttachmentError(
            "El contenido no corresponde a un archivo PDF."
        )

    try:
        reader = PdfReader(BytesIO(content), strict=True)

        if reader.is_encrypted:
            raise InvalidAttachmentError(
                "El PDF debe estar sin contraseña."
            )

        page_count = len(reader.pages)

        if not 1 <= page_count <= MAX_PDF_PAGES:
            raise InvalidAttachmentError(
                "El PDF debe contener entre 1 y 200 páginas."
            )

    except (
        PyPdfError,
        OSError,
        ValueError,
        KeyError,
        TypeError,
        RecursionError,
        OverflowError,
    ) as error:
        raise InvalidAttachmentError(
            "El PDF está dañado o no se puede procesar."
        ) from error