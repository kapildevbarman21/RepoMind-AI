"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FolderGit2,
  Search,
  Trash2,
  GitBranchPlus,
  ArrowRight,
  MessageSquareCode,
  Network,
  ShieldAlert,
  BookOpen,
} from "lucide-react";
import { api } from "@/lib/api";
import { Repository } from "@/lib/types";

export default function RepositoriesPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadRepos = async () => {
    setLoading(true);
    try {
      const data = await api.getRepositories();
      setRepos(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRepos();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete '${name}' and its indexed vectors?`)) return;
    setDeletingId(id);
    try {
      await api.deleteRepository(id);
      setRepos((prev) => prev.filter((r) => r.id !== id));
    } catch {
      alert("Failed to delete repository.");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredRepos = repos.filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.primary_language && r.primary_language.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FolderGit2 className="w-6 h-6 text-indigo-400" />
            My Repositories
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse and inspect all indexed codebases, architecture diagrams, and security reports.
          </p>
        </div>

        <Link
          href="/analyze"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <GitBranchPlus className="w-3.5 h-3.5" />
          <span>Analyze Repository</span>
        </Link>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by repository name, owner, or language..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
        />
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 rounded-xl bg-slate-900/60 border border-slate-800" />
          ))}
        </div>
      ) : filteredRepos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRepos.map((repo) => (
            <div
              key={repo.id}
              className="p-5 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/repositories/${repo.id}`}
                      className="font-bold text-white hover:text-indigo-400 text-base tracking-tight truncate block transition-colors"
                    >
                      {repo.full_name}
                    </Link>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {repo.description || "No description provided."}
                    </p>
                  </div>

                  <span
                    className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium shrink-0 border ${
                      repo.status === "COMPLETED"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : repo.status === "FAILED"
                        ? "bg-red-500/10 text-red-400 border-red-500/30"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse"
                    }`}
                  >
                    {repo.status}
                  </span>
                </div>

                {/* Progress bar if still analyzing */}
                {repo.status !== "COMPLETED" && repo.status !== "FAILED" && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>{repo.status_message}</span>
                      <span>{repo.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${repo.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Meta stats */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-4 font-mono">
                  <span className="text-indigo-400 font-sans font-medium">
                    {repo.primary_language || "Multi-language"}
                  </span>
                  <span>•</span>
                  <span>{repo.total_files} files</span>
                  <span>•</span>
                  <span>{repo.total_lines.toLocaleString()} lines</span>
                  <span>•</span>
                  <span>★ {repo.stars}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800/80">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/repositories/${repo.id}/chat`}
                    className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition-colors"
                    title="AI Chat"
                  >
                    <MessageSquareCode className="w-4 h-4" />
                  </Link>
                  <Link
                    href={`/repositories/${repo.id}/architecture`}
                    className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-sky-400 transition-colors"
                    title="Architecture Graph"
                  >
                    <Network className="w-4 h-4" />
                  </Link>
                  <Link
                    href={`/repositories/${repo.id}/security`}
                    className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
                    title="Security Report"
                  >
                    <ShieldAlert className="w-4 h-4" />
                  </Link>
                  <Link
                    href={`/repositories/${repo.id}/documentation`}
                    className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-violet-400 transition-colors"
                    title="Documentation"
                  >
                    <BookOpen className="w-4 h-4" />
                  </Link>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDelete(repo.id, repo.name)}
                    disabled={deletingId === repo.id}
                    className="p-1.5 rounded-lg border border-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 transition-colors"
                    title="Delete repository"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <Link
                    href={`/repositories/${repo.id}`}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-indigo-400 text-xs font-semibold transition-colors"
                  >
                    <span>Overview</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
          <FolderGit2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="font-semibold text-white text-base">No repositories found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            {search ? "No repositories match your filter criteria." : "Start by submitting a GitHub repository for deep codebase indexing."}
          </p>
          <Link
            href="/analyze"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <GitBranchPlus className="w-4 h-4" />
            <span>Analyze New Repository</span>
          </Link>
        </div>
      )}
    </div>
  );
}
