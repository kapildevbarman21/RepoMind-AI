from fastapi import APIRouter
from app.core.config import settings
import time

router = APIRouter(tags=["Health"])

START_TIME = time.time()

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "uptime_seconds": round(time.time() - START_TIME, 2),
        "database": "connected",
        "llm_provider": settings.LLM_PROVIDER,
    }
