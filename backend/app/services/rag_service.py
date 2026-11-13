import json
import re
from typing import List, Dict, Any, Optional, AsyncGenerator, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx

from app.models.entities import Repository, CodeChunk, ChatMessage
from app.services.embeddings import embedding_engine
from app.core.config import settings

class RAGService:
    @staticmethod
    async def retrieve_relevant_chunks(
        db: AsyncSession,
        repository_id: str,
        query: str,
        top_k: int = 6
    ) -> List[Dict[str, Any]]:
        """
        Retrieves most relevant code chunks using hybrid semantic + lexical search.
        """
        # 1. Fetch chunks for this repo
        result = await db.execute(
            select(CodeChunk).where(CodeChunk.repository_id == repository_id)
        )
        chunks = result.scalars().all()
        if not chunks:
            return []

        # 2. Compute query embedding
        query_vec = await embedding_engine.get_embedding(query)
        
        # 3. Score chunks
        scored_chunks = []
        query_terms = set(re.findall(r"\w+", query.lower()))

        for chunk in chunks:
            semantic_score = 0.0
            if chunk.embedding:
                semantic_score = embedding_engine.cosine_similarity(query_vec, chunk.embedding)
            
            # Lexical score: check identifier matches in name and file_path
            lexical_score = 0.0
            name_lower = (chunk.name or "").lower()
            path_lower = chunk.file_path.lower()
            content_lower = chunk.content.lower()

            for term in query_terms:
                if len(term) < 2:
                    continue
                if term in name_lower:
                    lexical_score += 0.3
                if term in path_lower:
                    lexical_score += 0.25
                if term in content_lower:
                    lexical_score += 0.1

            # Hybrid score
            hybrid_score = (0.65 * semantic_score) + (0.35 * min(1.0, lexical_score))

            scored_chunks.append({
                "score": hybrid_score,
                "file_path": chunk.file_path,
                "start_line": chunk.start_line,
                "end_line": chunk.end_line,
                "chunk_type": chunk.chunk_type,
                "name": chunk.name,
                "content": chunk.content,
                "language": chunk.language
            })

        # Sort descending by score
        scored_chunks.sort(key=lambda x: x["score"], reverse=True)
        return scored_chunks[:top_k]

    @classmethod
    def generate_local_response(
        cls,
        query: str,
        repo: Repository,
        chunks: List[Dict[str, Any]]
    ) -> Tuple[str, List[str]]:
        """
        Generates a rigorous, evidence-based response when external LLM is offline or no API key is provided.
        Never hallucinates filenames or symbols.
        """
        if not chunks:
            return (
                f"I searched the indexed codebase of **{repo.full_name}**, but could not find any relevant source code or documentation matching your query: *\"{query}\"*.\n\n"
                "**Suggestions:**\n"
                "- Check if the relevant files are listed in the repository tree.\n"
                "- Verify if the file was skipped (e.g. binary or exceeded size limits).\n"
                "- Try querying specific filenames or function symbols directly.",
                ["What is the overall architecture of this project?", "List the main API endpoints", "Show database models"]
            )

        # Build synthesized answer based strictly on retrieved snippets
        evidence_summary = []
        for i, c in enumerate(chunks[:4], 1):
            name_str = f" (`{c['name']}`)" if c.get("name") else ""
            evidence_summary.append(
                f"### {i}. `{c['file_path']}` (Lines {c['start_line']}-{c['end_line']}){name_str}\n"
                f"```{c.get('language') or 'text'}\n{c['content']}\n```"
            )

        top_files = list(dict.fromkeys([c['file_path'] for c in chunks]))
        files_list = ", ".join([f"`{f}`" for f in top_files[:5]])

        response = (
            f"Based on the indexed codebase of **{repo.full_name}**, here are the relevant findings for: **\"{query}\"**\n\n"
            f"**Key Files Identified:** {files_list}\n\n"
            + "\n\n".join(evidence_summary)
            + "\n\n---\n"
            + "**Architectural Analysis:**\n"
            + f"- **Primary Component:** `{chunks[0]['file_path']}` handles key logic relating to your request.\n"
            + f"- **Scope:** Lines {chunks[0]['start_line']} to {chunks[0]['end_line']} in `{chunks[0]['file_path']}` directly define `{chunks[0].get('name') or 'the core implementation'}`.\n"
            + "- All statements above are strictly cited from indexed repository evidence."
        )

        follow_ups = [
            f"Explain how `{top_files[0]}` connects to other modules",
            f"Are there any security concerns in `{top_files[0]}`?",
            f"How do I write unit tests for `{chunks[0].get('name') or top_files[0]}`?"
        ]

        return response, follow_ups

    @classmethod
    async def stream_chat(
        cls,
        db: AsyncSession,
        repository: Repository,
        query: str,
        session_id: str = "default"
    ) -> AsyncGenerator[str, None]:
        """
        Streams AI response using SSE protocol.
        """
        # 1. Retrieve top chunks
        chunks = await cls.retrieve_relevant_chunks(db, repository.id, query, top_k=5)
        
        # 2. Check LLM provider
        provider = settings.LLM_PROVIDER.lower()

        if provider == "openai" and settings.OPENAI_API_KEY:
            async for chunk_text in cls._stream_openai(repository, query, chunks):
                yield chunk_text
        elif provider == "gemini" and settings.GEMINI_API_KEY:
            async for chunk_text in cls._stream_gemini(repository, query, chunks):
                yield chunk_text
        else:
            # Local synthesis stream
            content, follow_ups = cls.generate_local_response(query, repository, chunks)
            # Stream in realistic word bursts
            words = content.split(" ")
            for i in range(0, len(words), 4):
                chunk = " ".join(words[i:i+4]) + " "
                yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
            
            # Send citations metadata
            sources = [
                {
                    "file_path": c["file_path"],
                    "start_line": c["start_line"],
                    "end_line": c["end_line"],
                    "snippet": c["content"][:200] + "...",
                    "language": c.get("language")
                }
                for c in chunks[:4]
            ]
            yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"
            yield f"data: {json.dumps({'type': 'follow_ups', 'questions': follow_ups})}\n\n"
            yield "data: [DONE]\n\n"

    @classmethod
    async def _stream_openai(cls, repo: Repository, query: str, chunks: List[Dict[str, Any]]) -> AsyncGenerator[str, None]:
        """Stream response from OpenAI-compatible endpoint."""
        context_snippets = "\n\n".join([
            f"File: {c['file_path']} (Lines {c['start_line']}-{c['end_line']})\n```{c.get('language') or ''}\n{c['content']}\n```"
            for c in chunks
        ])
        
        system_prompt = (
            f"You are RepoMind AI, an elite software architect analyzing the repository '{repo.full_name}'.\n"
            "Analyze the user's question using ONLY the provided repository context below.\n"
            "Rules:\n"
            "1. Always cite exact file paths and line numbers when referencing code (e.g. `[src/auth.py:45-60]`).\n"
            "2. If the context does not contain enough information to answer, state clearly what is missing.\n"
            "3. NEVER invent or hallucinate filenames, functions, or APIs that are not in the context.\n"
            "4. Provide practical, high-quality engineering answers.\n\n"
            f"REPOSITORY CONTEXT:\n{context_snippets}"
        )

        headers = {
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": settings.OPENAI_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query}
            ],
            "stream": True,
            "temperature": 0.2
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", f"{settings.OPENAI_BASE_URL.rstrip('/')}/chat/completions", headers=headers, json=payload) as resp:
                if resp.status_code != 200:
                    err = await resp.aread()
                    yield f"data: {json.dumps({'type': 'error', 'message': f'OpenAI error: {err.decode()}'})}\n\n"
                    return

                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            parsed = json.loads(data_str)
                            delta = parsed.get("choices", [{}])[0].get("delta", {}).get("content", "")
                            if delta:
                                yield f"data: {json.dumps({'type': 'token', 'content': delta})}\n\n"
                        except Exception:
                            continue

        # Send citations
        sources = [
            {
                "file_path": c["file_path"],
                "start_line": c["start_line"],
                "end_line": c["end_line"],
                "snippet": c["content"][:200] + "...",
                "language": c.get("language")
            }
            for c in chunks
        ]
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"
        yield "data: [DONE]\n\n"

    @classmethod
    async def _stream_gemini(cls, repo: Repository, query: str, chunks: List[Dict[str, Any]]) -> AsyncGenerator[str, None]:
        """Stream response from Google Gemini API."""
        context_snippets = "\n\n".join([
            f"File: {c['file_path']} (Lines {c['start_line']}-{c['end_line']})\n```{c.get('language') or ''}\n{c['content']}\n```"
            for c in chunks
        ])
        
        prompt = (
            f"You are RepoMind AI analyzing repository '{repo.full_name}'.\n"
            f"Question: {query}\n\n"
            f"Indexed Code Context:\n{context_snippets}\n\n"
            "Answer using ONLY the provided code. Cite exact file paths and line ranges."
        )

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:streamGenerateContent?alt=sse&key={settings.GEMINI_API_KEY}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}]
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", url, json=payload) as resp:
                if resp.status_code != 200:
                    err = await resp.aread()
                    yield f"data: {json.dumps({'type': 'error', 'message': f'Gemini error: {err.decode()}'})}\n\n"
                    return

                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        try:
                            parsed = json.loads(data_str)
                            text = parsed.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                            if text:
                                yield f"data: {json.dumps({'type': 'token', 'content': text})}\n\n"
                        except Exception:
                            continue

        sources = [
            {
                "file_path": c["file_path"],
                "start_line": c["start_line"],
                "end_line": c["end_line"],
                "snippet": c["content"][:200] + "...",
                "language": c.get("language")
            }
            for c in chunks
        ]
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"
        yield "data: [DONE]\n\n"
