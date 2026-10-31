"""Verify Supabase access tokens and authorize application administrators."""
from functools import lru_cache
from uuid import UUID
from urllib.parse import urlparse

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_session
from app.models.content import User

bearer = HTTPBearer(auto_error=False)


def unauthorized():
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Credenciais inválidas ou expiradas', headers={'WWW-Authenticate': 'Bearer'})


@lru_cache(maxsize=4)
def jwks_client(url: str):
    return PyJWKClient(url, cache_jwk_set=True, lifespan=300, timeout=5)


def verify_access_token(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    if credentials is None or credentials.scheme.lower() != 'bearer':
        raise unauthorized()
    settings = get_settings()
    base = (settings.supabase_url or '').rstrip('/')
    parsed = urlparse(base)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path:
        raise HTTPException(status_code=503, detail='Autenticação indisponível')
    issuer = f'{base}/auth/v1'
    try:
        header = jwt.get_unverified_header(credentials.credentials)
        algorithm = header.get('alg')
        if algorithm == 'HS256' and settings.supabase_jwt_secret:
            key = settings.supabase_jwt_secret.get_secret_value()
            if len(key.encode()) < 32:
                raise ValueError('Invalid signing key')
        elif algorithm in ('ES256', 'RS256') and isinstance(header.get('kid'), str):
            key = jwks_client(f'{issuer}/.well-known/jwks.json').get_signing_key_from_jwt(credentials.credentials).key
        else:
            raise unauthorized()
        claims = jwt.decode(credentials.credentials, key, algorithms=[algorithm], issuer=issuer, audience=settings.supabase_jwt_audience, options={'require': ['exp', 'iat', 'sub', 'iss', 'aud']})
        UUID(claims['sub'])
        return claims
    except HTTPException:
        raise
    except (jwt.PyJWKClientConnectionError, TimeoutError):
        raise HTTPException(status_code=503, detail='Autenticação temporariamente indisponível') from None
    except (jwt.PyJWTError, ValueError, TypeError, KeyError):
        raise unauthorized() from None


def require_admin(claims: dict = Depends(verify_access_token), session: Session = Depends(get_session)) -> dict:
    user = session.scalar(select(User).where(User.auth_provider_subject == claims['sub']))
    if user is None or user.role != 'admin':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Acesso não autorizado')
    return {'id': str(user.id), 'email': claims.get('email') if isinstance(claims.get('email'), str) else None, 'role': 'admin'}
