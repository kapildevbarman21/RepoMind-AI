import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.entities import Repository, ChatMessage
from app.models.schemas import ChatMessageRequest, ChatMessageResponse, ChatSource
from app.services.rag_service import RAGService

router = APIRouter(prefix="/repositories", tags=["AI Chat"])

@router.post("/{repo_id}/chat")
async def chat_with_codebase(
    repo_id: str,
    payload: ChatMessageRequest,
    stream: bool = Query(False, description="Enable SSE streaming response"),
    db: AsyncSession = Depends(get_db)
):
    """
    Asks questions against the repository's indexed codebase.
    Returns strictly fact-grounded evidence with file and line citations.
    """
    res = await db.execute(select(Repository).where(Repository.id == repo_id))
    repo = res.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    if repo.status != "COMPLETED":
        raise HTTPException(
            status_code=400,
            detail=f"Repository is currently in status '{repo.status}'. Please wait until indexing completes."
        )

    # Save user message to DB
    user_msg = ChatMessage(
        repository_id=repo.id,
        session_id=payload.session_id or "default",
        role="user",
        content=payload.message
    )
    db.add(user_msg)
    await db.commit()

    if stream:
        return StreamingResponse(
            RAGService.stream_chat(db, repo, payload.message, payload.session_id or "default"),
            media_type="text/event-stream"
        )

    # Non-streaming JSON path
    chunks = await RAGService.retrieve_relevant_chunks(db, repo.id, payload.message, top_k=5)
    content, follow_ups = RAGService.generate_local_response(payload.message, repo, chunks)

    sources = [
        ChatSource(
            file_path=c["file_path"],
            start_line=c["start_line"],
            end_line=c["end_line"],
            snippet=c["content"][:240] + "...",
            language=c.get("language")
        )
        for c in chunks[:4]
    ]

    assistant_msg = ChatMessage(
        repository_id=repo.id,
        session_id=payload.session_id or "default",
        role="assistant",
        content=content,
        sources=[s.dict() for s in sources]
    )
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(assistant_msg)

    return ChatMessageResponse(
        id=assistant_msg.id,
        role="assistant",
        content=assistant_msg.content,
        sources=sources,
        follow_up_questions=follow_ups,
        created_at=assistant_msg.created_at
    )


@router.get("/{repo_id}/chat/history", response_model=List[ChatMessageResponse])
async def get_chat_history(
    repo_id: str,
    session_id: str = Query("default"),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve chat conversation history for a given repository session."""
    stmt = select(ChatMessage).where(
        ChatMessage.repository_id == repo_id,
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.created_at.asc()).limit(limit)
    
    result = await db.execute(stmt)
    messages = result.scalars().all()

    response = []
    for m in messages:
        srcs = [
            ChatSource(
                file_path=s.get("file_path", ""),
                start_line=s.get("start_line", 1),
                end_line=s.get("end_line", 1),
                snippet=s.get("snippet", ""),
                language=s.get("language")
            )
            for s in (m.sources or [])
        ]
        response.append(ChatMessageResponse(
            id=m.id,
            role=m.role,
            content=m.content,
            sources=srcs,
            follow_up_questions=[],
            created_at=m.created_at
        ))
    return response
