from functools import lru_cache
from collections.abc import Iterator
from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from app.core.config import get_settings

@lru_cache
def get_engine() -> Engine:
    # Limita conexões por processo ao usar o Session Pooler; pre_ping recupera conexões obsoletas.
    return create_engine(get_settings().sqlalchemy_url(), pool_size=3, max_overflow=0, pool_pre_ping=True, pool_recycle=1800, hide_parameters=True, connect_args={"connect_timeout": 5})

def get_session() -> Iterator[Session]:
    try:
        engine = get_engine()
    except Exception:
        raise HTTPException(status_code=503, detail="Banco de dados temporariamente indisponível") from None
    with sessionmaker(bind=engine, expire_on_commit=False)() as session:
        yield session

def verify_connection() -> bool:
    try:
        with get_engine().connect() as connection:
            return connection.execute(text("SELECT 1")).scalar_one() == 1
    except Exception:
        # Não registrar a exceção: drivers podem incluir partes da URL de conexão.
        return False
