import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, Boolean, DateTime, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class Repository(Base):
    __tablename__ = "repositories"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    owner = Column(String(255), nullable=False)
    full_name = Column(String(510), nullable=False, index=True)
    url = Column(String(1024), nullable=False)
    description = Column(Text, nullable=True)
    default_branch = Column(String(100), default="main")
    current_branch = Column(String(100), default="main")
    commit_sha = Column(String(64), nullable=True)
    
    stars = Column(Integer, default=0)
    forks = Column(Integer, default=0)
    watchers = Column(Integer, default=0)
    open_issues = Column(Integer, default=0)
    size_kb = Column(Integer, default=0)
    
    primary_language = Column(String(50), nullable=True)
    languages = Column(JSON, default=dict)  # {"Python": 70.5, "TypeScript": 29.5}
    
    status = Column(String(50), default="PENDING", index=True) # PENDING, CLONING, PARSING, INDEXING, COMPLETED, FAILED
    status_message = Column(Text, default="Queued for analysis")
    progress = Column(Integer, default=0)  # 0 to 100
    
    total_files = Column(Integer, default=0)
    total_lines = Column(Integer, default=0)
    total_chunks = Column(Integer, default=0)
    
    architecture_summary = Column(Text, nullable=True)
    skipped_files = Column(JSON, default=list)  # [{"path": "...", "reason": "..."}]
    
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    files = relationship("FileItem", back_populates="repository", cascade="all, delete-orphan")
    chunks = relationship("CodeChunk", back_populates="repository", cascade="all, delete-orphan")
    security_findings = relationship("SecurityFinding", back_populates="repository", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="repository", cascade="all, delete-orphan")
    documents = relationship("DocumentationItem", back_populates="repository", cascade="all, delete-orphan")


class FileItem(Base):
    __tablename__ = "file_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    repository_id = Column(String(36), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    path = Column(String(1024), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    extension = Column(String(50), nullable=True)
    language = Column(String(50), nullable=True)
    size_bytes = Column(Integer, default=0)
    line_count = Column(Integer, default=0)
    is_binary = Column(Boolean, default=False)
    sha256_hash = Column(String(64), nullable=True)
    
    imports = Column(JSON, default=list)  # list of imported modules / files
    exports = Column(JSON, default=list)  # list of exported functions / classes
    functions_count = Column(Integer, default=0)
    classes_count = Column(Integer, default=0)
    
    repository = relationship("Repository", back_populates="files")


class CodeChunk(Base):
    __tablename__ = "code_chunks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    repository_id = Column(String(36), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path = Column(String(1024), nullable=False, index=True)
    language = Column(String(50), nullable=True)
    chunk_type = Column(String(50), default="block") # function, class, module, block
    name = Column(String(255), nullable=True)
    start_line = Column(Integer, nullable=False)
    end_line = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    content_hash = Column(String(64), nullable=False, index=True)
    
    # Store embedding as JSON float array for universal DB compatibility (SQLite + Postgres)
    embedding = Column(JSON, nullable=True)
    
    repository = relationship("Repository", back_populates="chunks")


class SecurityFinding(Base):
    __tablename__ = "security_findings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    repository_id = Column(String(36), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    rule_id = Column(String(100), nullable=False)
    title = Column(String(255), nullable=False)
    severity = Column(String(20), nullable=False, index=True) # CRITICAL, HIGH, MEDIUM, LOW, INFO
    category = Column(String(50), nullable=False) # SECRET, INJECTION, CONFIGURATION, DEPENDENCY, CODE_QUALITY
    file_path = Column(String(1024), nullable=False)
    line_number = Column(Integer, default=1)
    code_snippet = Column(Text, nullable=True)
    description = Column(Text, nullable=False)
    suggested_remediation = Column(Text, nullable=True)
    is_confirmed = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=utc_now)
    
    repository = relationship("Repository", back_populates="security_findings")


class ArchitectureGraph(Base):
    __tablename__ = "architecture_graphs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    repository_id = Column(String(36), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, unique=True)
    graph_data = Column(JSON, nullable=False) # { nodes: [...], edges: [...], components: [...] }
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    repository_id = Column(String(36), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(String(64), default="default", index=True)
    role = Column(String(20), nullable=False) # user, assistant, system
    content = Column(Text, nullable=False)
    sources = Column(JSON, default=list) # [{ file_path, start_line, end_line, snippet }]
    created_at = Column(DateTime, default=utc_now)
    
    repository = relationship("Repository", back_populates="chat_messages")


class DocumentationItem(Base):
    __tablename__ = "documentation_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    repository_id = Column(String(36), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    doc_type = Column(String(50), nullable=False) # README, ARCHITECTURE, API, ONBOARDING, CONTRIBUTING
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    
    repository = relationship("Repository", back_populates="documents")
