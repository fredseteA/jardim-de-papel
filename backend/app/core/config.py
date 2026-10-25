from functools import lru_cache
from pydantic import SecretStr
from sqlalchemy.engine import make_url
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: SecretStr | None = None
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    def sqlalchemy_url(self) -> str:
        if not self.database_url:
            raise ValueError("DATABASE_URL não configurada")
        url = self.database_url.get_secret_value()
        if url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://"):]
        elif url.startswith("postgres://"):
            url = "postgresql+psycopg://" + url[len("postgres://"):]
        if not url.startswith("postgresql+psycopg://"):
            raise ValueError("DATABASE_URL deve usar PostgreSQL e Psycopg 3")
        try:
            parsed = make_url(url)
        except Exception:
            raise ValueError("DATABASE_URL inválida") from None
        if parsed.host and parsed.host.endswith(".supabase.com"):
            sslmode = parsed.query.get("sslmode")
            if sslmode in ("disable", "allow", "prefer"):
                raise ValueError("A conexão Supabase exige TLS")
            if not sslmode:
                parsed = parsed.update_query_dict({"sslmode": "require"})
        return parsed.render_as_string(hide_password=False)

@lru_cache
def get_settings() -> Settings:
    return Settings()
