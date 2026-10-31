from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from app.api.v1.router import router
from app.core.config import get_settings
from app.api.v1.admin import router as admin_router
from app.api.v1.admin_stories import router as admin_stories_router
from app.api.v1.admin_content import router as admin_content_router
from app.api.v1.admin_media import router as admin_media_router
from app.core.database import verify_connection

app = FastAPI(title="Jardim de Papel API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_origins, allow_credentials=False, allow_methods=["GET", "POST", "PATCH", "DELETE"], allow_headers=["Content-Type", "Authorization"])
app.include_router(router)
app.include_router(admin_router)
app.include_router(admin_stories_router)
app.include_router(admin_content_router)
app.include_router(admin_media_router)

@app.exception_handler(SQLAlchemyError)
def database_error(_request: Request, _error: SQLAlchemyError):
    return JSONResponse(status_code=503, content={"detail": "Banco de dados temporariamente indisponível"})

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/health/ready")
def readiness():
    if not verify_connection():
        return JSONResponse(status_code=503, content={"status": "unavailable"})
    return {"status": "ok"}
