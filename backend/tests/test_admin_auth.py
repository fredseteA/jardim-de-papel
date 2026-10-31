from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4
import jwt
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from app.core import admin_auth
from app.core.database import get_session
from app.main import app
SECRET = 'testing-secret-only-12345678901234567890'
SUBJECT = str(uuid4())
ISSUER = 'https://example.supabase.co/auth/v1'

@pytest.fixture
def auth_client(monkeypatch):
    monkeypatch.setattr(admin_auth, 'get_settings', lambda: SimpleNamespace(supabase_url='https://example.supabase.co', supabase_jwt_audience='authenticated', supabase_jwt_secret=SecretStr(SECRET)))
    account = SimpleNamespace(id=uuid4(), role='reader')
    app.dependency_overrides[get_session] = lambda: SimpleNamespace(scalar=lambda _: account)
    with TestClient(app) as client:
        yield client, account
    app.dependency_overrides.clear()

def token(**overrides):
    now = datetime.now(timezone.utc)
    claims = {'sub': SUBJECT, 'iss': ISSUER, 'aud': 'authenticated', 'iat': now, 'exp': now + timedelta(minutes=5), 'email': 'test@example.invalid'}
    claims.update(overrides)
    return jwt.encode(claims, SECRET, algorithm='HS256')

def test_missing_and_invalid_token(auth_client):
    client, _ = auth_client
    assert client.get('/api/v1/admin/me').status_code == 401
    assert client.get('/api/v1/admin/me', headers={'Authorization': 'Bearer invalid'}).status_code == 401
    assert client.get('/api/v1/admin/me', headers={'Authorization': f'Bearer {token(aud="wrong")}'}).status_code == 401
    assert client.get('/api/v1/admin/me', headers={'Authorization': f'Bearer {token(iss="https://wrong.invalid")}'}).status_code == 401

def test_expired_token(auth_client):
    client, _ = auth_client
    assert client.get('/api/v1/admin/me', headers={'Authorization': f'Bearer {token(exp=datetime.now(timezone.utc)-timedelta(seconds=1))}'}).status_code == 401

def test_reader_forbidden_admin_allowed(auth_client):
    client, account = auth_client
    headers = {'Authorization': f'Bearer {token()}'}
    assert client.get('/api/v1/admin/me', headers=headers).status_code == 403
    account.role = 'admin'
    response = client.get('/api/v1/admin/me', headers=headers)
    assert response.status_code == 200
    assert response.json() == {'id': str(account.id), 'email': 'test@example.invalid', 'role': 'admin'}
    assert client.get('/health').status_code == 200

def test_unsupported_algorithm_rejected(auth_client):
    client, _ = auth_client
    forged = jwt.encode({'sub': SUBJECT}, key='', algorithm='none')
    assert client.get('/api/v1/admin/me', headers={'Authorization': f'Bearer {forged}'}).status_code == 401

def test_asymmetric_signature_and_key_selection(auth_client, monkeypatch):
    from cryptography.hazmat.primitives.asymmetric import ec
    client, account = auth_client
    account.role = 'admin'
    private = ec.generate_private_key(ec.SECP256R1())
    monkeypatch.setattr(admin_auth, 'jwks_client', lambda url: SimpleNamespace(get_signing_key_from_jwt=lambda value: SimpleNamespace(key=private.public_key())))
    now = datetime.now(timezone.utc)
    claims = {'sub': SUBJECT, 'iss': ISSUER, 'aud': 'authenticated', 'iat': now, 'exp': now + timedelta(minutes=5)}
    signed = jwt.encode(claims, private, algorithm='ES256', headers={'kid': 'test-key'})
    assert client.get('/api/v1/admin/me', headers={'Authorization': f'Bearer {signed}'}).status_code == 200
    forged = jwt.encode(claims, ec.generate_private_key(ec.SECP256R1()), algorithm='ES256', headers={'kid': 'test-key'})
    assert client.get('/api/v1/admin/me', headers={'Authorization': f'Bearer {forged}'}).status_code == 401
