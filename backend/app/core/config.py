from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
import os
from pathlib import Path

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )

    PROJECT_NAME: str = "RepoMind AI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./repomind.db"
    
    # Redis (Optional in local dev, enabled in docker/prod)
    REDIS_URL: Optional[str] = None
    
    # Security & CORS
    SECRET_KEY: str = "repomind-secret-key-development-minimum-32-chars"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]
    
    # GitHub Integration
    GITHUB_TOKEN: Optional[str] = None
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    
    # AI Providers
    LLM_PROVIDER: str = "mock" # mock, openai, gemini, ollama
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-1.5-flash"
    
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"
    
    # Repository Analysis Constraints
    MAX_REPO_SIZE_MB: int = 100
    MAX_FILE_SIZE_KB: int = 500
    MAX_INDEXED_FILES: int = 1000
    ANALYSIS_TIMEOUT_SECONDS: int = 300
    REPOS_STORAGE_PATH: str = str(Path.home() / ".repomind" / "repositories")
    
    # Vector dimension
    EMBEDDING_DIMENSION: int = 384

settings = Settings()
os.makedirs(settings.REPOS_STORAGE_PATH, exist_ok=True)
