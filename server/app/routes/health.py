from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db
from app.core.logging_config import logger

router = APIRouter(prefix="/health", tags=["health"])

@router.get("/live", status_code=status.HTTP_200_OK)
async def liveness():
    """
    Liveness probe. Checks if the server is running.
    """
    return {"status": "alive"}

@router.get("/ready", status_code=status.HTTP_200_OK)
async def readiness(db: AsyncSession = Depends(get_db)):
    """
    Readiness probe. Checks database connectivity.
    """
    try:
        # Run a simple select 1 to check database connectivity
        result = await db.execute(text("SELECT 1"))
        val = result.scalar()
        if val != 1:
            raise Exception("Database returned invalid value")
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        logger.error("Readiness check failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Readiness check failed: Database connection issue"
        )
