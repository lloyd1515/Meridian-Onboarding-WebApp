import json
from typing import List, Optional, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENVIRONMENT: str = Field(default="development")
    LOG_LEVEL: str = Field(default="INFO")

    # Database
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/postgres"
    )

    # JWT
    JWT_SECRET: str = Field(default="placeholder_jwt_secret_key_change_me_in_production_min_32_chars")
    JWT_ALGORITHM: str = Field(default="HS256")

    # Rate Limiting
    RATE_LIMIT_MAX_REQUESTS: int = Field(default=60)
    RATE_LIMIT_WINDOW_SECONDS: int = Field(default=60)
    # /scheduler is a bulk, authenticated hr_admin operation: HybridScheduler.tsx
    # saves the whole seed dataset (~210 employees) as one POST per employee,
    # which blows past the 60/60s brute-force-protection limit meant for public/
    # auth endpoints. Give it its own, much more generous budget instead.
    SCHEDULER_RATE_LIMIT_MAX_REQUESTS: int = Field(default=1000)

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = Field(default=["http://localhost:5173", "http://127.0.0.1:5173"])

    # Slack webhook (optional): when unset, the /notifications/slack endpoint
    # no-ops instead of erroring, so deployments without Slack configured still
    # work via the existing copy-to-clipboard fallback.
    SLACK_WEBHOOK_URL: Optional[str] = Field(default=None)

    # Email digest (optional): HR daily digest of open questions + overdue
    # checklist tasks (server/scripts/send_digest.py). When SMTP_HOST or
    # DIGEST_RECIPIENT_EMAILS is unset, the script logs the digest and exits
    # 0 instead of erroring, mirroring SLACK_WEBHOOK_URL's no-op pattern so
    # it's safe to cron in any environment.
    SMTP_HOST: Optional[str] = Field(default=None)
    SMTP_PORT: int = Field(default=587)
    SMTP_USERNAME: Optional[str] = Field(default=None)
    SMTP_PASSWORD: Optional[str] = Field(default=None)
    SMTP_FROM_ADDRESS: Optional[str] = Field(default=None)
    # Plain comma-separated string, deliberately NOT List[str]: pydantic-settings
    # tries json.loads on List[str] env values before falling back to anything
    # else, which crashes on a plain CSV value like "a@x.com,b@x.com" (the same
    # trap BACKEND_CORS_ORIGINS works around with its own field_validator).
    # Use digest_recipient_list() to get a parsed list.
    DIGEST_RECIPIENT_EMAILS: Optional[str] = Field(default=None)

    def digest_recipient_list(self) -> List[str]:
        if not self.DIGEST_RECIPIENT_EMAILS:
            return []
        return [e.strip() for e in self.DIGEST_RECIPIENT_EMAILS.split(",") if e.strip()]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, str):
            try:
                decoded = json.loads(v)
                if isinstance(decoded, list):
                    return [str(item) for item in decoded]
            except Exception:
                pass
        elif isinstance(v, list):
            return [str(item) for item in v]
        return []

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_url(cls, v: str) -> str:
        if not v:
            raise ValueError("DATABASE_URL cannot be empty")
        # Automatically convert postgresql:// to postgresql+asyncpg:// if needed
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @field_validator("ENVIRONMENT")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        allowed = {"development", "production", "testing", "staging"}
        if v.lower() not in allowed:
            raise ValueError(f"ENVIRONMENT must be one of {allowed}")
        return v.lower()

    @field_validator("LOG_LEVEL")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        allowed = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        if v.upper() not in allowed:
            raise ValueError(f"LOG_LEVEL must be one of {allowed}")
        return v.upper()

    @field_validator("JWT_SECRET")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        if not v or len(v) < 8:
            raise ValueError("JWT_SECRET must be at least 8 characters long")
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
