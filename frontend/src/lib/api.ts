import {
  Repository,
  FileItem,
  ArchitectureData,
  SecurityReport,
  DocumentationItem,
  ChatMessage,
  DashboardStats,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let errorDetail = "An unexpected error occurred.";
    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch {
      errorDetail = await res.text();
    }
    throw new Error(errorDetail);
  }

  return res.json();
}

export const api = {
  async getDashboardStats(): Promise<DashboardStats> {
    return fetchJson<DashboardStats>(`${API_BASE}/dashboard/stats`);
  },

  async analyzeRepository(payload: {
    url: string;
    branch?: string;
    commit?: string;
    auth_token?: string;
  }): Promise<Repository> {
    return fetchJson<Repository>(`${API_BASE}/repositories/analyze`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getRepositories(skip = 0, limit = 50): Promise<Repository[]> {
    return fetchJson<Repository[]>(`${API_BASE}/repositories?skip=${skip}&limit=${limit}`);
  },

  async getRepository(id: string): Promise<Repository> {
    return fetchJson<Repository>(`${API_BASE}/repositories/${id}`);
  },

  async getRepositoryStatus(id: string): Promise<{
    id: string;
    status: string;
    status_message: string;
    progress: number;
    total_files: number;
    total_chunks: number;
  }> {
    return fetchJson(`${API_BASE}/repositories/${id}/status`);
  },

  async getRepositoryFiles(id: string): Promise<FileItem[]> {
    return fetchJson<FileItem[]>(`${API_BASE}/repositories/${id}/files`);
  },

  async getFileContent(id: string, path: string): Promise<{ path: string; content: string; language?: string }> {
    return fetchJson(`${API_BASE}/repositories/${id}/file-content?path=${encodeURIComponent(path)}`);
  },

  async getRepositoryArchitecture(id: string): Promise<ArchitectureData> {
    return fetchJson<ArchitectureData>(`${API_BASE}/repositories/${id}/architecture`);
  },

  async getRepositorySecurity(id: string): Promise<SecurityReport> {
    return fetchJson<SecurityReport>(`${API_BASE}/repositories/${id}/security`);
  },

  async getRepositoryDocumentation(id: string): Promise<DocumentationItem[]> {
    return fetchJson<DocumentationItem[]>(`${API_BASE}/repositories/${id}/documentation`);
  },

  async sendChatMessage(
    id: string,
    message: string,
    sessionId = "default"
  ): Promise<ChatMessage> {
    return fetchJson<ChatMessage>(`${API_BASE}/repositories/${id}/chat`, {
      method: "POST",
      body: JSON.stringify({ message, session_id: sessionId }),
    });
  },

  async getChatHistory(id: string, sessionId = "default"): Promise<ChatMessage[]> {
    return fetchJson<ChatMessage[]>(`${API_BASE}/repositories/${id}/chat/history?session_id=${sessionId}`);
  },

  async reindexRepository(id: string): Promise<Repository> {
    return fetchJson<Repository>(`${API_BASE}/repositories/${id}/reindex`, {
      method: "POST",
    });
  },

  async deleteRepository(id: string): Promise<{ status: string; message: string }> {
    return fetchJson(`${API_BASE}/repositories/${id}`, {
      method: "DELETE",
    });
  },

  async checkHealth(): Promise<{ status: string; version: string; service: string }> {
    return fetchJson(`http://localhost:8000/api/health`);
  },
};
