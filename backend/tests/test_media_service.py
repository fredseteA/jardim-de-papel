from io import BytesIO

import pytest
from fastapi import HTTPException, UploadFile

from app.modules.stories.media_service import _validate_file


def upload(name: str, mime: str) -> UploadFile:
    return UploadFile(filename=name, file=BytesIO(), headers={'content-type': mime})


def test_media_validator_accepts_known_image_signature():
    mime, media_type, extension = _validate_file(upload('ilustracao.png', 'image/png'), b'\x89PNG\r\n\x1a\nconteudo')
    assert (mime, media_type, extension) == ('image/png', 'image', 'png')


def test_media_validator_rejects_extension_and_content_mismatch():
    with pytest.raises(HTTPException) as extension_error:
        _validate_file(upload('arquivo.exe', 'image/png'), b'\x89PNG\r\n\x1a\n')
    assert extension_error.value.status_code == 422
    with pytest.raises(HTTPException) as content_error:
        _validate_file(upload('foto.jpg', 'image/jpeg'), b'not-an-image')
    assert content_error.value.status_code == 422
