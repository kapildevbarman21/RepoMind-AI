from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, field_validator
import re

class RepositoryAnalyzeRequest(BaseModel):
    url: str = Field(..., description="GitHub repository URL or 'owner/repo' format", json_schema_extra={"example": "https://github.com/fastapi/fastapi"})
    branch: Optional[str] = Field(default=None, description="Specific branch to analyze")
    commit: Optional[str] = Field(default=None, description="Specific commit hash to analyze")
    auth_token: Optional[str] = Field(default=None, description="Optional GitHub Personal Access Token")

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        v = v.strip()
        # Accept 'owner/repo' shorthand
        if re.match(r"^[a-zA-Z0-9_\-\.]+/[a-zA-Z0-9_\-\.]+$", v):
            return f"https://github.com/{v}"
        
        # Must be valid GitHub URL
        match = re.match(r"^https?://(www\.)?github\.com/([a-zA-Z0-9_\-\.]+)/([a-zA-Z0-9_\-\.]+?)(/|\.git)?$", v)
        if not match:
            raise ValueError("URL must be a valid GitHub repository URL (e.g., https://github.com/owner/repo)")
        owner, repo = match.group(2), match.group(3)
        return f"https://github.com/{owner}/{repo}"


class SkippedFile(BaseModel):
    path: str
    reason: str


class RepositoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    owner: str
    full_name: str
    url: str
    description: Optional[str] = None
    default_branch: str
    current_branch: str
    commit_sha: Optional[str] = None
    stars: int = 0
    forks: int = 0
    watchers: int = 0
    open_issues: int = 0
    size_kb: int = 0
    primary_language: Optional[str] = None
    languages: Dict[str, float] = {}
    status: str
    status_message: str
    progress: int
    total_files: int
    total_lines: int
    total_chunks: int
    architecture_summary: Optional[str] = None
    skipped_files: List[SkippedFile] = []
    created_at: datetime
    updated_at: datetime


class RepositoryStatusResponse(BaseModel):
    id: str
    status: str
    status_message: str
    progress: int
    total_files: int
    total_chunks: int


class FileItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    path: str
    name: str
    extension: Optional[str] = None
    language: Optional[str] = None
    size_bytes: int
    line_count: int
    is_binary: bool
    imports: List[str] = []
    exports: List[str] = []
    functions_count: int
    classes_count: int


class FileTreeNode(BaseModel):
    name: str
    path: str
    type: str # 'file' | 'directory'
    size: Optional[int] = None
    language: Optional[str] = None
    children: Optional[List["FileTreeNode"]] = None


class ArchitectureNode(BaseModel):
    id: str
    label: str
    type: str # 'entrypoint', 'service', 'model', 'route', 'utility', 'ui', 'config'
    filePath: Optional[str] = None
    language: Optional[str] = None
    details: Dict[str, Any] = {}


class ArchitectureEdge(BaseModel):
    id: str
    source: str
    target: str
    label: Optional[str] = None
    relation: str # 'imports', 'calls', 'extends', 'routes_to'


class ArchitectureResponse(BaseModel):
    repository_id: str
    summary: Optional[str] = None
    nodes: List[ArchitectureNode] = []
    edges: List[ArchitectureEdge] = []
    components_breakdown: Dict[str, int] = {}


class SecurityFindingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    rule_id: str
    title: str
    severity: str # CRITICAL, HIGH, MEDIUM, LOW, INFO
    category: str # SECRET, INJECTION, CONFIGURATION, DEPENDENCY, CODE_QUALITY
    file_path: str
    line_number: int
    code_snippet: Optional[str] = None
    description: str
    suggested_remediation: Optional[str] = None
    is_confirmed: bool


class SecurityReportResponse(BaseModel):
    repository_id: str
    total_findings: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    findings: List[SecurityFindingResponse] = []


class DocumentationItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    doc_type: str # README, ARCHITECTURE, API, ONBOARDING, CONTRIBUTING
    title: str
    content: str
    updated_at: datetime


class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: Optional[str] = "default"


class ChatSource(BaseModel):
    file_path: str
    start_line: int
    end_line: int
    snippet: str
    language: Optional[str] = None


class ChatMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    sources: List[ChatSource] = []
    follow_up_questions: List[str] = []
    created_at: datetime


class DashboardStatsResponse(BaseModel):
    total_repositories: int
    total_files_processed: int
    total_lines_analyzed: int
    total_chunks_indexed: int
    total_security_issues: int
    languages_distribution: Dict[str, int]
    recent_repositories: List[RepositoryResponse]
