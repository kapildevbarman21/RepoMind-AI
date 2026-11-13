"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  GitBranchPlus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Shield,
  KeyRound,
  Sparkles,
} from "lucide-react";
import { GithubIcon } from "@/components/ui/GithubIcon";
import { api } from "@/lib/api";

const PRESET_REPOS = [
  { name: "fastapi/fastapi", desc: "High performance Python web framework", stars: "78k" },
  { name: "expressjs/express", desc: "Fast, unopinionated Node.js web framework", stars: "65k" },
  { name: "pallets/flask", desc: "Lightweight Python WSGI web application framework", stars: "67k" },
  { name: "facebook/react", desc: "The library for web and native user interfaces", stars: "230k" },
];

export default function AnalyzePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [commit, setCommit] = useState("");
  const [token, setToken] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setError(null);
    setSubmitting(true);

    try {
      const repo = await api.analyzeRepository({
        url: url.trim(),
        branch: branch.trim() || undefined,
        commit: commit.trim() || undefined,
        auth_token: token.trim() || undefined,
      });

      // Navigate to repository detail page
      router.push(`/repositories/${repo.id}`);
    } catch (err: any) {
      setError(err?.message || "Failed to analyze repository. Please verify the URL.");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Title */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Intelligent Codebase Ingestion</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Analyze a GitHub Repository
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          Connect any public or private repository. RepoMind AI will parse its AST, extract call graphs, run static security audits, and index functions for AI reasoning.
        </p>
      </div>

      {/* Main Analysis Form */}
      <div className="p-6 md:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              GitHub Repository URL or owner/repo
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <GithubIcon className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/fastapi/fastapi or owner/repo"
                className="w-full pl-11 pr-4 py-3 bg-[#0B0F17] border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-mono"
                required
              />
            </div>
            <p className="text-[12px] text-slate-500 mt-1.5">
              Works out-of-the-box with any public repository. No login or OAuth required.
            </p>
          </div>

          {/* Quick presets */}
          <div>
            <span className="text-xs text-slate-400 font-medium mr-2">Or try popular open-source:</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {PRESET_REPOS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setUrl(`https://github.com/${preset.name}`)}
                  className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-800/40 hover:bg-slate-800 text-slate-300 text-xs font-mono transition-colors flex items-center gap-1.5"
                >
                  <span>{preset.name}</span>
                  <span className="text-[10px] text-amber-400 font-sans">★ {preset.stars}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Toggle Advanced Options */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors"
            >
              <span>{showAdvanced ? "Hide Advanced Options" : "Show Advanced Options (Branch, Commit, Token)"}</span>
            </button>
          </div>

          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800/60">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Specific Branch
                </label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="e.g. main, dev, v2"
                  className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-700 rounded-lg text-white text-xs placeholder-slate-600 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Specific Commit SHA
                </label>
                <input
                  type="text"
                  value={commit}
                  onChange={(e) => setCommit(e.target.value)}
                  placeholder="e.g. 7f8a9b1"
                  className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-700 rounded-lg text-white text-xs placeholder-slate-600 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                  <KeyRound className="w-3 h-3 text-amber-400" />
                  GitHub Token (Optional)
                </label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_... for private repos"
                  className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-700 rounded-lg text-white text-xs placeholder-slate-600 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-950/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !url.trim()}
            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Initializing Analysis Pipeline...</span>
              </>
            ) : (
              <>
                <GitBranchPlus className="w-4 h-4" />
                <span>Start Intelligent Analysis</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Feature Highlights Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold mb-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>AST Code Parsing</span>
          </div>
          <p className="text-xs text-slate-400">
            Extracts exact functions, classes, and dependencies using Tree-sitter parsers across 15+ languages.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="flex items-center gap-2 text-sky-400 text-xs font-semibold mb-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>Fact-Grounded Vector RAG</span>
          </div>
          <p className="text-xs text-slate-400">
            Answers questions strictly with real line numbers and code snippets. Zero hallucinated APIs.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold mb-1.5">
            <Shield className="w-4 h-4" />
            <span>Static Security Auditing</span>
          </div>
          <p className="text-xs text-slate-400">
            Uncovers exposed API keys, private certificates, SQL injections, and dangerous configurations safely.
          </p>
        </div>
      </div>
    </div>
  );
}
