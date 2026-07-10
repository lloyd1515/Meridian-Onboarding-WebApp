from typing import Union
from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from app.core.logging_config import logger

async def validation_exception_handler(request: Request, exc: Union[ValidationError, RequestValidationError]):
    logger.warning("Validation error occurred", errors=exc.errors())
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            # jsonable_encoder: custom field_validator errors carry the raw
            # ValueError in ctx, which json.dumps alone can't serialize.
            "detail": jsonable_encoder(exc.errors()),
            "message": "Validation failed"
        }
    )

async def integrity_exception_handler(request: Request, exc: IntegrityError):
    logger.error("Database integrity error occurred", error=str(exc))
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={
            "message": "Database integrity constraint violation",
            "detail": str(exc.orig) if hasattr(exc, "orig") else str(exc)
        }
    )

async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception occurred", error=str(exc))
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "message": "An unexpected error occurred on the server.",
        }
    )

def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ValidationError, validation_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(IntegrityError, integrity_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
