export interface SkippedFile {
  path: string;
  reason: string;
}

export interface Repository {
  id: string;
  name: string;
  owner: string;
  full_name: string;
  url: string;
  description: string | null;
  default_branch: string;
  current_branch: string;
  commit_sha: string | null;
  stars: number;
  forks: number;
  watchers: number;
  open_issues: number;
  size_kb: number;
  primary_language: string | null;
  languages: Record<string, number>;
  status: "PENDING" | "CLONING" | "PARSING" | "INDEXING" | "COMPLETED" | "FAILED";
  status_message: string;
  progress: number;
  total_files: number;
  total_lines: number;
  total_chunks: number;
  architecture_summary: string | null;
  skipped_files: SkippedFile[];
  created_at: string;
  updated_at: string;
}

export interface FileItem {
  id: string;
  path: string;
  name: string;
  extension: string | null;
  language: string | null;
  size_bytes: number;
  line_count: number;
  is_binary: boolean;
  imports: string[];
  exports: string[];
  functions_count: number;
  classes_count: number;
}

export interface ArchitectureNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    filePath: string;
    type: "entrypoint" | "route" | "service" | "model" | "ui" | "utility" | "config";
    language?: string;
    lineCount: number;
    functionsCount: number;
    classesCount: number;
    functions: string[];
    classes: string[];
  };
}

export interface ArchitectureEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  relation: string;
  animated?: boolean;
}

export interface ArchitectureData {
  repository_id: string;
  summary: string;
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  components_breakdown: Record<string, number>;
}

export interface SecurityFinding {
  id: string;
  rule_id: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  category: "SECRET" | "INJECTION" | "CONFIGURATION" | "DEPENDENCY" | "CODE_QUALITY";
  file_path: string;
  line_number: number;
  code_snippet: string | null;
  description: string;
  suggested_remediation: string | null;
  is_confirmed: boolean;
}

export interface SecurityReport {
  repository_id: string;
  total_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  findings: SecurityFinding[];
}

export interface DocumentationItem {
  id: string;
  doc_type: "README" | "ARCHITECTURE" | "API" | "ONBOARDING" | "CONTRIBUTING";
  title: string;
  content: string;
  updated_at: string;
}

export interface ChatSource {
  file_path: string;
  start_line: number;
  end_line: number;
  snippet: string;
  language?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources: ChatSource[];
  follow_up_questions?: string[];
  created_at: string;
}

export interface DashboardStats {
  total_repositories: number;
  total_files_processed: number;
  total_lines_analyzed: number;
  total_chunks_indexed: number;
  total_security_issues: number;
  languages_distribution: Record<string, number>;
  recent_repositories: Repository[];
}
