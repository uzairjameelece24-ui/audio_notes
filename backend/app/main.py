import logging
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError, HTTPException

from app.config import settings
from app.routers import health, uploads, recordings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [API] %(message)s"
)
logger = logging.getLogger("api")

app = FastAPI(
    title="Audio Notes API",
    description="FastAPI backend for Audio Notes - Speech-to-Text via Gnani ASR and structured LLM summarization.",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if "*" in settings.cors_origins_list else settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)


# --- Exception Handlers for Unified Error Schema ---

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # If detail is already a structured dict matching our error format
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    elif isinstance(exc.detail, dict) and "code" in exc.detail:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.detail.get("code", "HTTP_ERROR"), "message": exc.detail.get("message", "An error occurred")}}
        )
    else:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": f"HTTP_{exc.status_code}", "message": str(exc.detail)}}
        )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    first_error = errors[0] if errors else {}
    field = ".".join(str(loc) for loc in first_error.get("loc", []))
    msg = first_error.get("msg", "Validation error")
    clean_msg = f"{field}: {msg}" if field else msg

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": {"code": "VALIDATION_ERROR", "message": clean_msg}}
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled server error: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": {"code": "INTERNAL_SERVER_ERROR", "message": "An unexpected internal server error occurred."}}
    )


# --- Routers (mounted under both /api and root for full client URL compatibility) ---
app.include_router(health.router, prefix="/api")
app.include_router(uploads.router, prefix="/api")
app.include_router(recordings.router, prefix="/api")

app.include_router(health.router, prefix="")
app.include_router(uploads.router, prefix="")
app.include_router(recordings.router, prefix="")


@app.get("/")
def root():
    return {
        "service": "Audio Notes API",
        "docs": "/docs",
        "health": "/api/health"
    }
