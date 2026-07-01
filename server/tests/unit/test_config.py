import pytest
from pydantic import ValidationError
from app.core.config import Settings

def test_valid_config():
    settings = Settings(
        ENVIRONMENT="development",
        LOG_LEVEL="DEBUG",
        DATABASE_URL="postgresql://user:pass@localhost:5432/db",
        JWT_SECRET="supersecretkey123!",
        BACKEND_CORS_ORIGINS="http://localhost:3000,http://localhost:5173"
    )
    assert settings.DATABASE_URL == "postgresql+asyncpg://user:pass@localhost:5432/db"
    assert settings.ENVIRONMENT == "development"
    assert settings.LOG_LEVEL == "DEBUG"
    assert settings.JWT_SECRET == "supersecretkey123!"
    assert settings.BACKEND_CORS_ORIGINS == ["http://localhost:3000", "http://localhost:5173"]

def test_cors_origins_json():
    settings = Settings(
        BACKEND_CORS_ORIGINS='["http://localhost:3000", "http://localhost:8080"]'
    )
    assert settings.BACKEND_CORS_ORIGINS == ["http://localhost:3000", "http://localhost:8080"]

def test_invalid_environment():
    with pytest.raises(ValidationError) as exc_info:
        Settings(ENVIRONMENT="invalid")
    assert "ENVIRONMENT must be one of" in str(exc_info.value)

def test_invalid_log_level():
    with pytest.raises(ValidationError) as exc_info:
        Settings(LOG_LEVEL="INVALID")
    assert "LOG_LEVEL must be one of" in str(exc_info.value)

def test_invalid_jwt_secret():
    with pytest.raises(ValidationError) as exc_info:
        Settings(JWT_SECRET="short")
    assert "JWT_SECRET must be at least 8 characters long" in str(exc_info.value)

def test_empty_database_url():
    with pytest.raises(ValidationError) as exc_info:
        Settings(DATABASE_URL="")
    assert "DATABASE_URL cannot be empty" in str(exc_info.value)
