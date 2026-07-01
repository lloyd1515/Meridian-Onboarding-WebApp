from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine
from app.core.error_handlers import register_error_handlers
from app.core.logging_config import CorrelationIdMiddleware, logger
from app.routes import health

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up FastAPI application", environment=settings.ENVIRONMENT, log_level=settings.LOG_LEVEL)
    yield
    logger.info("Shutting down FastAPI application... Disposing DB engine.")
    await engine.dispose()

app = FastAPI(
    title="Meridian Onboarding API",
    description="Backend API for Meridian Onboarding Web App",
    version="1.0.0",
    lifespan=lifespan,
)

# Apply Correlation ID middleware
app.add_middleware(CorrelationIdMiddleware)

# Apply CORS middleware
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Register global error handlers
register_error_handlers(app)

# Include routes
app.include_router(health.router)

@app.get("/")
async def root():
    return {
        "app": "Meridian Onboarding API",
        "status": "running",
        "environment": settings.ENVIRONMENT
    }
