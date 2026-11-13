import os
import asyncio
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.entities import (
    Repository, FileItem, CodeChunk, ArchitectureGraph,
    SecurityFinding, DocumentationItem, ChatMessage
)
from app.models.schemas import (
    RepositoryAnalyzeRequest, RepositoryResponse, RepositoryStatusResponse,
    FileItemResponse, FileTreeNode, ArchitectureResponse,
    SecurityReportResponse, DocumentationItemResponse
)
from app.services.github_service import GitHubService, parse_github_url, is_safe_url
from app.services.pipeline import AnalysisPipeline

router = APIRouter(prefix="/repositories", tags=["Repositories"])

@router.post("/analyze", response_model=RepositoryResponse)
async def analyze_repository(
    payload: RepositoryAnalyzeRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Submits a GitHub repository for deep codebase analysis and vector indexing.
    """
    # Guard against SSRF
    if not is_safe_url(payload.url):
        raise HTTPException(status_code=400, detail="Invalid repository URL. Only public GitHub repositories are permitted.")

    try:
        owner, repo_name = parse_github_url(payload.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Check if this repository is already registered
    full_name = f"{owner}/{repo_name}"
    existing = await db.execute(
        select(Repository).where(Repository.full_name.ilike(full_name))
    )
    repo = existing.scalar_one_or_none()

    if not repo:
        # Fetch GitHub metadata
        try:
            meta = await GitHubService.fetch_repository_metadata(owner, repo_name, payload.auth_token)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to fetch repository from GitHub: {str(e)}")

        repo = Repository(
            name=meta["name"],
            owner=meta["owner"],
            full_name=meta["full_name"],
            url=meta["url"],
            description=meta["description"],
            default_branch=meta["default_branch"],
            current_branch=payload.branch or meta["default_branch"],
            stars=meta["stars"],
            forks=meta["forks"],
            watchers=meta["watchers"],
            open_issues=meta["open_issues"],
            size_kb=meta["size_kb"],
            primary_language=meta["primary_language"],
            languages=meta["languages"],
            status="PENDING",
            status_message="Queued for analysis...",
            progress=0
        )
        db.add(repo)
        await db.commit()
        await db.refresh(repo)
    else:
        # Re-triggering analysis on existing repo
        repo.status = "PENDING"
        repo.status_message = "Analysis queued..."
        repo.progress = 0
        if payload.branch:
            repo.current_branch = payload.branch
        await db.commit()
        await db.refresh(repo)

    # Launch background indexing task
    background_tasks.add_task(
        AnalysisPipeline.run,
        repo.id,
        payload.branch,
        payload.commit,
        payload.auth_token
    )

    return repo


@router.get("", response_model=List[RepositoryResponse])
async def list_repositories(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """List all repositories ordered by most recently analyzed."""
    stmt = select(Repository).order_by(Repository.updated_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{repo_id}", response_model=RepositoryResponse)
async def get_repository(repo_id: str, db: AsyncSession = Depends(get_db)):
    """Get single repository details."""
    result = await db.execute(select(Repository).where(Repository.id == repo_id))
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    return repo


@router.get("/{repo_id}/status", response_model=RepositoryStatusResponse)
async def get_repository_status(repo_id: str, db: AsyncSession = Depends(get_db)):
    """Get live processing status and progress for polling."""
    result = await db.execute(select(Repository).where(Repository.id == repo_id))
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    return RepositoryStatusResponse(
        id=repo.id,
        status=repo.status,
        status_message=repo.status_message,
        progress=repo.progress,
        total_files=repo.total_files,
        total_chunks=repo.total_chunks
    )


@router.get("/{repo_id}/files", response_model=List[FileItemResponse])
async def get_repository_files(
    repo_id: str,
    limit: int = Query(500, le=2000),
    db: AsyncSession = Depends(get_db)
):
    """Get indexed file list."""
    stmt = select(FileItem).where(FileItem.repository_id == repo_id).order_by(FileItem.path.asc()).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{repo_id}/file-content")
async def get_file_content(
    repo_id: str,
    path: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve indexed chunks/content for a specific file to display in Monaco editor."""
    stmt = select(CodeChunk).where(
        CodeChunk.repository_id == repo_id,
        CodeChunk.file_path == path
    ).order_by(CodeChunk.start_line.asc())
    result = await db.execute(stmt)
    chunks = result.scalars().all()
    
    if not chunks:
        # Check if file item exists
        f_stmt = select(FileItem).where(FileItem.repository_id == repo_id, FileItem.path == path)
        f_res = await db.execute(f_stmt)
        item = f_res.scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=404, detail="File not found in index")
        return {"path": path, "content": f"// File {path} was indexed with {item.line_count} lines."}

    combined = "\n".join([c.content for c in chunks])
    return {
        "path": path,
        "content": combined,
        "language": chunks[0].language if chunks else "text"
    }


@router.get("/{repo_id}/architecture", response_model=ArchitectureResponse)
async def get_repository_architecture(repo_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve React Flow architecture graph and component analysis."""
    result = await db.execute(
        select(ArchitectureGraph).where(ArchitectureGraph.repository_id == repo_id)
    )
    graph = result.scalar_one_or_none()
    if not graph:
        # Return fallback empty graph if still processing
        return ArchitectureResponse(
            repository_id=repo_id,
            summary="Architecture graph generation is queued or in progress.",
            nodes=[],
            edges=[],
            components_breakdown={}
        )

    gdata = graph.graph_data
    return ArchitectureResponse(
        repository_id=repo_id,
        summary=gdata.get("summary"),
        nodes=gdata.get("nodes", []),
        edges=gdata.get("edges", []),
        components_breakdown=gdata.get("components_breakdown", {})
    )


@router.get("/{repo_id}/security", response_model=SecurityReportResponse)
async def get_repository_security(repo_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve security scanner audit results."""
    result = await db.execute(
        select(SecurityFinding).where(SecurityFinding.repository_id == repo_id).order_by(SecurityFinding.created_at.desc())
    )
    findings = result.scalars().all()

    crit = sum(1 for f in findings if f.severity == "CRITICAL")
    high = sum(1 for f in findings if f.severity == "HIGH")
    med = sum(1 for f in findings if f.severity == "MEDIUM")
    low = sum(1 for f in findings if f.severity in ("LOW", "INFO"))

    return SecurityReportResponse(
        repository_id=repo_id,
        total_findings=len(findings),
        critical_count=crit,
        high_count=high,
        medium_count=med,
        low_count=low,
        findings=findings
    )


@router.get("/{repo_id}/documentation", response_model=List[DocumentationItemResponse])
async def get_repository_documentation(repo_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve generated technical documentation items."""
    result = await db.execute(
        select(DocumentationItem).where(DocumentationItem.repository_id == repo_id)
    )
    return result.scalars().all()


@router.post("/{repo_id}/reindex", response_model=RepositoryResponse)
async def reindex_repository(
    repo_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Re-analyzes and re-indexes the repository."""
    result = await db.execute(select(Repository).where(Repository.id == repo_id))
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    # Clear previous sub-entities
    await db.execute(delete(FileItem).where(FileItem.repository_id == repo.id))
    await db.execute(delete(CodeChunk).where(CodeChunk.repository_id == repo.id))
    await db.execute(delete(SecurityFinding).where(SecurityFinding.repository_id == repo.id))
    await db.execute(delete(ArchitectureGraph).where(ArchitectureGraph.repository_id == repo.id))
    await db.execute(delete(DocumentationItem).where(DocumentationItem.repository_id == repo.id))

    repo.status = "PENDING"
    repo.status_message = "Re-indexing queued..."
    repo.progress = 0
    await db.commit()
    await db.refresh(repo)

    background_tasks.add_task(AnalysisPipeline.run, repo.id, repo.current_branch)
    return repo


@router.delete("/{repo_id}")
async def delete_repository(repo_id: str, db: AsyncSession = Depends(get_db)):
    """Deletes repository and cascades all associated knowledge index data."""
    result = await db.execute(select(Repository).where(Repository.id == repo_id))
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    await db.delete(repo)
    await db.commit()
    return {"status": "success", "message": f"Repository '{repo.name}' deleted successfully."}
