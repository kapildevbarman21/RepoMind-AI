"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FolderGit2,
  FileCode2,
  ShieldCheck,
  GitBranchPlus,
  RefreshCw,
  Clock,
  ArrowRight,
  AlertCircle,
  Database,
  Layers,
} from "lucide-react";
import { api } from "@/lib/api";
import { DashboardStats } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDashboardStats();
      setStats(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load dashboard metrics. Ensure backend is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome Hero / Quick action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/60">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            Engineering Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time codebase intelligence, vector indexing metrics, and repository analytics.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchStats}
            disabled={loading}
            className="p-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Link
            href="/analyze"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-md shadow-indigo-600/20 transition-all hover:shadow-indigo-600/30"
          >
            <GitBranchPlus className="w-4 h-4" />
            <span>Analyze New Repository</span>
          </Link>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-950/20 text-red-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-red-300">Connection Error</div>
            <div className="mt-0.5 text-red-200/90">{error}</div>
            <button
              onClick={fetchStats}
              className="mt-2 text-xs text-red-300 underline font-medium hover:text-red-100"
            >
              Try reconnecting
            </button>
          </div>
        </div>
      )}

      {/* Loading state skeleton */}
      {loading && !stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-slate-900/70 border border-slate-800" />
          ))}
        </div>
      )}

      {/* Metric Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Repositories Analyzed</span>
              <FolderGit2 className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="mt-3 text-2xl font-bold text-white tracking-tight">
              {stats.total_repositories}
            </div>
            <div className="mt-1 text-xs text-slate-500">Live indexed projects</div>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Files Processed</span>
              <FileCode2 className="w-4 h-4 text-sky-400" />
            </div>
            <div className="mt-3 text-2xl font-bold text-white tracking-tight">
              {stats.total_files_processed.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {stats.total_lines_analyzed.toLocaleString()} lines analyzed
            </div>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Vector Chunks</span>
              <Database className="w-4 h-4 text-violet-400" />
            </div>
            <div className="mt-3 text-2xl font-bold text-white tracking-tight">
              {stats.total_chunks_indexed.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-slate-500">Searchable semantic embeddings</div>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Security Findings</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-3 text-2xl font-bold text-white tracking-tight">
              {stats.total_security_issues}
            </div>
            <div className="mt-1 text-xs text-slate-500">AST & pattern vulnerability scans</div>
          </div>
        </div>
      )}

      {/* Main Content: Languages Distribution & Recent Repositories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Languages breakdown */}
        <div className="lg:col-span-1 p-5 rounded-xl bg-slate-900/70 border border-slate-800/80">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Detected Languages
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">AST Parsed</span>
          </div>

          {stats && Object.keys(stats.languages_distribution).length > 0 ? (
            <div className="mt-4 space-y-3">
              {Object.entries(stats.languages_distribution)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([lang, count]) => {
                  const total = stats.total_files_processed || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={lang}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-slate-300 capitalize">{lang}</span>
                        <span className="text-slate-400 font-mono">
                          {count} files ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(5, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 text-xs">
              No languages recorded yet. Submit a repository to begin analysis.
            </div>
          )}
        </div>

        {/* Recent Repositories History */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-slate-900/70 border border-slate-800/80">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-sky-400" />
              Recent Repository Activity
            </h3>
            <Link
              href="/repositories"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {stats && stats.recent_repositories.length > 0 ? (
            <div className="mt-4 divide-y divide-slate-800/60">
              {stats.recent_repositories.map((repo) => (
                <div
                  key={repo.id}
                  className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/repositories/${repo.id}`}
                      className="font-medium text-slate-200 hover:text-indigo-400 text-sm tracking-tight truncate block transition-colors"
                    >
                      {repo.full_name}
                    </Link>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span>{repo.primary_language || "Multi-language"}</span>
                      <span>•</span>
                      <span>{repo.total_files} files</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(repo.updated_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${
                        repo.status === "COMPLETED"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : repo.status === "FAILED"
                          ? "bg-red-500/10 text-red-400 border-red-500/30"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse"
                      }`}
                    >
                      {repo.status}
                    </span>

                    <Link
                      href={`/repositories/${repo.id}`}
                      className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                      title="Explore repository"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-14 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mx-auto text-slate-400 mb-3">
                <FolderGit2 className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-slate-200 text-sm">No repositories analyzed yet</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                Connect any public GitHub repository to index its functions, classes, dependencies, and architecture.
              </p>
              <Link
                href="/analyze"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <GitBranchPlus className="w-3.5 h-3.5" />
                <span>Analyze Your First Repository</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
