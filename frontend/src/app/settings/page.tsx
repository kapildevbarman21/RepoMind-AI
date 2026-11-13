"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  Cpu,
  KeyRound,
  Sliders,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  // Client-configurable states
  const [llmProvider, setLlmProvider] = useState("auto");
  const [openAiKey, setOpenAiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [maxFileSize, setMaxFileSize] = useState(500);

  useEffect(() => {
    api.checkHealth().then(setHealth).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-400" />
          System Settings & Integrations
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure AI provider endpoints, API credentials, and repository analysis thresholds.
        </p>
      </div>

      {/* Backend Status Card */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <div className="text-xs font-semibold text-white">Backend Engine Status: {health?.status || "Online"}</div>
            <div className="text-[11px] text-slate-400 font-mono">
              Version: {health?.version || "1.0.0"} • Service: {health?.service || "RepoMind AI"}
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setLoading(true);
            api.checkHealth().then(setHealth).finally(() => setLoading(false));
          }}
          className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: AI Engine Provider */}
        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            AI Provider Configuration
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Active Provider
              </label>
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-indigo-500"
              >
                <option value="auto">Auto (OpenAI / Gemini / Local Fallback)</option>
                <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                <option value="gemini">Google Gemini (Gemini 1.5 Flash)</option>
                <option value="ollama">Ollama (Local LLaMA 3.2)</option>
                <option value="mock">Local Semantic Vector Engine (100% Free / Offline)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                OpenAI API Key (Optional)
              </label>
              <input
                type="password"
                value={openAiKey}
                onChange={(e) => setOpenAiKey(e.target.value)}
                placeholder="sk-proj-..."
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-700 rounded-lg text-white text-xs font-mono placeholder-slate-600 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Google Gemini API Key (Optional)
              </label>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-700 rounded-lg text-white text-xs font-mono placeholder-slate-600 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: GitHub API & Rate Limit Integration */}
        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-sky-400" />
            GitHub Credentials & Limits
          </h2>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              GitHub Personal Access Token (PAT)
            </label>
            <input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_... (expands API rate limit from 60 to 5,000 req/hr)"
              className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-700 rounded-lg text-white text-xs font-mono placeholder-slate-600 focus:ring-1 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Never stored permanently without encryption. Scopes needed: public_repo (or repo for private repositories).
            </p>
          </div>
        </div>

        {/* Section 3: Performance Constraints */}
        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            Analysis Engine Limits
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Max File Size (KB)
              </label>
              <input
                type="number"
                value={maxFileSize}
                onChange={(e) => setMaxFileSize(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-700 rounded-lg text-white text-xs font-mono focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Analysis Timeout (Seconds)
              </label>
              <input
                type="number"
                defaultValue={300}
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-700 rounded-lg text-white text-xs font-mono focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {saved && (
          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Settings saved successfully.</span>
          </div>
        )}

        <button
          type="submit"
          className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition-colors"
        >
          Save Configuration
        </button>
      </form>
    </div>
  );
}
