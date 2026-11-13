import pytest
from app.services.embeddings import EmbeddingEngine
from app.services.rag_service import RAGService
from app.models.entities import Repository

@pytest.mark.asyncio
async def test_embedding_cosine_similarity():
    engine = EmbeddingEngine()
    # Test semantic vectors
    vec_auth1 = await engine.get_embedding("user authentication login jwt token")
    vec_auth2 = await engine.get_embedding("authenticate user credentials password")
    vec_unrelated = await engine.get_embedding("planetary orbit celestial astrophysics galaxy")

    sim_related = engine.cosine_similarity(vec_auth1, vec_auth2)
    sim_unrelated = engine.cosine_similarity(vec_auth1, vec_unrelated)

    assert sim_related > sim_unrelated
    assert sim_related > 0.3
    assert sim_unrelated < 0.15

def test_rag_local_response_grounding():
    repo = Repository(
        id="test-repo-123",
        name="test-repo",
        owner="octocat",
        full_name="octocat/test-repo",
        url="https://github.com/octocat/test-repo",
        total_files=5,
        total_lines=150
    )

    chunks = [
        {
            "score": 0.92,
            "file_path": "src/auth/jwt.py",
            "start_line": 15,
            "end_line": 35,
            "chunk_type": "function",
            "name": "create_access_token",
            "content": "def create_access_token(data: dict):\n    return jwt.encode(data, SECRET_KEY)",
            "language": "python"
        }
    ]

    answer, follow_ups = RAGService.generate_local_response("How does token generation work?", repo, chunks)
    assert "src/auth/jwt.py" in answer
    assert "create_access_token" in answer
    assert len(follow_ups) >= 2
