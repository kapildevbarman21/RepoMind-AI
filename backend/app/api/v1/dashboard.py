from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.entities import Repository, FileItem, CodeChunk, SecurityFinding
from app.models.schemas import DashboardStatsResponse, RepositoryResponse

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    """
    Computes real, live statistics across all analyzed repositories from the database.
    Never returns fake or hardcoded statistics.
    """
    # 1. Total repositories
    total_repos_res = await db.execute(select(func.count(Repository.id)))
    total_repos = total_repos_res.scalar() or 0

    # 2. Total files processed
    total_files_res = await db.execute(select(func.count(FileItem.id)))
    total_files = total_files_res.scalar() or 0

    # 3. Total lines analyzed
    total_lines_res = await db.execute(select(func.sum(Repository.total_lines)))
    total_lines = total_lines_res.scalar() or 0

    # 4. Total chunks indexed
    total_chunks_res = await db.execute(select(func.count(CodeChunk.id)))
    total_chunks = total_chunks_res.scalar() or 0

    # 5. Total security issues
    total_sec_res = await db.execute(select(func.count(SecurityFinding.id)))
    total_sec = total_sec_res.scalar() or 0

    # 6. Languages distribution aggregated across indexed files
    lang_stmt = select(FileItem.language, func.count(FileItem.id)).group_by(FileItem.language)
    lang_res = await db.execute(lang_stmt)
    languages_dist = {row[0] or "Other": row[1] for row in lang_res.all() if row[0]}

    # 7. Recent repositories
    recent_res = await db.execute(
        select(Repository).order_by(Repository.updated_at.desc()).limit(6)
    )
    recent_repos = recent_res.scalars().all()

    return DashboardStatsResponse(
        total_repositories=total_repos,
        total_files_processed=total_files,
        total_lines_analyzed=int(total_lines),
        total_chunks_indexed=total_chunks,
        total_security_issues=total_sec,
        languages_distribution=languages_dist,
        recent_repositories=recent_repos
    )
