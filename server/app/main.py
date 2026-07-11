from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from app.core.config import settings
from app.core.database import engine
from app.core.error_handlers import register_error_handlers
from app.core.logging_config import CorrelationIdMiddleware, logger
from app.routes import health

# Rate limiting: keyed by client IP, using the window/max already defined in
# settings. Disabled during the "testing" environment so the pytest suite
# (many requests to the same endpoints in a loop) doesn't trip it -- same
# environment-conditional pattern logging_config.py uses for its renderer.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.RATE_LIMIT_MAX_REQUESTS}/{settings.RATE_LIMIT_WINDOW_SECONDS}second"],
    enabled=settings.ENVIRONMENT != "testing",
)

# /scheduler is a bulk, authenticated hr_admin operation (not a public/
# brute-forceable endpoint like auth), so it gets its own, much more
# generous limiter -- see SCHEDULER_RATE_LIMIT_MAX_REQUESTS in config.py.
scheduler_limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.SCHEDULER_RATE_LIMIT_MAX_REQUESTS}/{settings.RATE_LIMIT_WINDOW_SECONDS}second"],
    enabled=settings.ENVIRONMENT != "testing",
)

async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    logger.warning("Rate limit exceeded", client=get_remote_address(request))
    return JSONResponse(
        status_code=429,
        content={
            "message": "Too many requests",
            "detail": str(exc.detail),
        },
    )

class RateLimitMiddleware(BaseHTTPMiddleware):
    """slowapi ships its own SlowAPIMiddleware, but it locates the matched
    route by walking app.routes for an object exposing a plain `.endpoint`
    attribute -- FastAPI 0.139's grouped-router internals (_IncludedRouter)
    no longer expose that on top-level app.routes, so that lookup always
    returns None and every request is silently exempted from the limit.
    We only need the global (undecorated) limit here, which doesn't
    require resolving the route handler at all, so check it directly."""
    async def dispatch(self, request: Request, call_next):
        limiter = (
            request.app.state.scheduler_limiter
            if request.url.path.startswith("/scheduler")
            else request.app.state.limiter
        )
        if limiter.enabled:
            try:
                limiter._check_request_limit(request, None, True)
            except RateLimitExceeded as exc:
                return await rate_limit_exceeded_handler(request, exc)
        return await call_next(request)

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

# Rate limiting (global, keyed by client IP)
app.state.limiter = limiter
app.state.scheduler_limiter = scheduler_limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
app.add_middleware(RateLimitMiddleware)

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
from app.routes import auth, employees, checklist, scheduler, backup, questions, checklist_templates
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(checklist.router)
app.include_router(scheduler.router)
app.include_router(backup.router)
app.include_router(questions.router)
app.include_router(checklist_templates.router)

@app.get("/")
async def root():
    return {
        "app": "Meridian Onboarding API",
        "status": "running",
        "environment": settings.ENVIRONMENT
    }
