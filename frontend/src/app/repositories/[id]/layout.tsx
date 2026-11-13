"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileCode2,
  MessageSquareCode,
  Network,
  ShieldAlert,
  BookOpen,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { Repository } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function RepoDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const repoId = resolvedParams.id;
  const pathname = usePathname();

  const [repo, setRepo] = useState<Repository | null>(null);
  const [reindexing, setReindexing] = useState(false);

  const loadRepo = async () => {
    try {
      const data = await api.getRepository(repoId);
      setRepo(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadRepo();
    // Poll if in progress
    const interval = setInterval(async () => {
      try {
        const st = await api.getRepositoryStatus(repoId);
        if (st.status !== "COMPLETED" && st.status !== "FAILED") {
          loadRepo();
        }
      } catch {
        // ignore
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [repoId]);

  const handleReindex = async () => {
    if (!confirm("Re-index this repository from scratch?")) return;
    setReindexing(true);
    try {
      const updated = await api.reindexRepository(repoId);
      setRepo(updated);
    } catch (err) {
      alert("Failed to trigger re-index");
    } finally {
      setReindexing(false);
    }
  };

  const tabs = [
    { name: "Code Browser", href: `/repositories/${repoId}`, icon: FileCode2, exact: true },
    { name: "AI Chat", href: `/repositories/${repoId}/chat`, icon: MessageSquareCode },
    { name: "Architecture", href: `/repositories/${repoId}/architecture`, icon: Network },
    { name: "Security Audit", href: `/repositories/${repoId}/security`, icon: ShieldAlert },
    { name: "Documentation", href: `/repositories/${repoId}/documentation`, icon: BookOpen },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner with Repo metadata */}
      <div className="p-6 rounded-2xl bg-[#0E131F] border border-slate-800 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mb-1.5">
              <Link href="/repositories" className="hover:text-slate-300">Repositories</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-400">{repo?.owner || "..."}</span>
            </div>

            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-white tracking-tight">
                {repo?.name || "Loading repository..."}
              </h1>
              {repo && (
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
              )}
            </div>

            <p className="text-xs text-slate-400 mt-1 max-w-2xl line-clamp-1">
              {repo?.description || "Automated repository indexing and intelligence engine."}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleReindex}
              disabled={reindexing || repo?.status === "PARSING" || repo?.status === "INDEXING"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-colors disabled:opacity-50"
              title="Re-run pipeline"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reindexing ? "animate-spin" : ""}`} />
              <span>Re-index</span>
            </button>

            {repo?.url && (
              <a
                href={repo.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-indigo-400 text-xs font-semibold transition-colors"
              >
                <span>GitHub</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Progress bar if running */}
        {repo && repo.status !== "COMPLETED" && repo.status !== "FAILED" && (
          <div className="mt-4 pt-4 border-t border-slate-800/80">
            <div className="flex justify-between text-xs text-slate-400 mb-1 font-mono">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                {repo.status_message}
              </span>
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

        {/* Quick Tabs */}
        <div className="flex items-center gap-1 mt-6 pt-4 border-t border-slate-800/80 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = tab.exact
              ? pathname === tab.href
              : pathname.startsWith(tab.href);

            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Child view container */}
      <div>{children}</div>
    </div>
  );
}
