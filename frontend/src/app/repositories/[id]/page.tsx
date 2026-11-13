"use client";

import { useEffect, useState, use } from "react";
import dynamic from "next/dynamic";
import {
  FileCode,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { FileItem, Repository } from "@/lib/types";

// Dynamic Monaco editor to prevent SSR hydration mismatch
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center text-slate-500 text-xs font-mono">
      Initializing Monaco Editor...
    </div>
  ),
});

export default function RepoOverviewAndCodeBrowserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const repoId = resolvedParams.id;

  const [repo, setRepo] = useState<Repository | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [fileContent, setFileContent] = useState<string>("// Select a file to inspect its source code.");
  const [, setLoadingContent] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);

  useEffect(() => {
    api.getRepository(repoId).then(setRepo).catch(console.error);
    api.getRepositoryFiles(repoId).then((data) => {
      setFiles(data);
      if (data.length > 0) {
        handleSelectFile(data[0]);
      }
    }).catch(console.error);
  }, [repoId]);

  const handleSelectFile = async (file: FileItem) => {
    setSelectedFile(file);
    setLoadingContent(true);
    try {
      const res = await api.getFileContent(repoId, file.path);
      setFileContent(res.content);
    } catch {
      setFileContent(`// Failed to load content for ${file.path}`);
    } finally {
      setLoadingContent(false);
    }
  };

  const mapLangToMonaco = (lang?: string | null) => {
    if (!lang) return "plaintext";
    const l = lang.toLowerCase();
    if (l === "python") return "python";
    if (l in ["javascript", "js", "jsx"]) return "javascript";
    if (l in ["typescript", "ts", "tsx"]) return "typescript";
    if (l === "go") return "go";
    if (l === "rust") return "rust";
    if (l === "java") return "java";
    if (l in ["c", "cpp"]) return "cpp";
    if (l === "html") return "html";
    if (l === "css") return "css";
    if (l === "json") return "json";
    if (l in ["yaml", "yml"]) return "yaml";
    if (l === "markdown") return "markdown";
    if (l === "sql") return "sql";
    return "plaintext";
  };

  return (
    <div className="space-y-6">
      {/* Analysis Coverage & Skipped Files Banner */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <CheckCircle className="w-4 h-4" />
            {repo?.total_files || 0} files indexed ({repo?.total_lines?.toLocaleString() || 0} LOC)
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400 font-mono">
            {repo?.total_chunks || 0} vector chunks ready for semantic RAG
          </span>
        </div>

        {repo?.skipped_files && repo.skipped_files.length > 0 && (
          <button
            onClick={() => setShowSkipped(!showSkipped)}
            className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-medium transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{repo.skipped_files.length} skipped files (view reasons)</span>
          </button>
        )}
      </div>

      {/* Skipped files modal/drawer */}
      {showSkipped && repo?.skipped_files && (
        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs space-y-2">
          <div className="font-semibold text-amber-300 flex items-center justify-between">
            <span>Skipped Files Audit & Explanations:</span>
            <button
              onClick={() => setShowSkipped(false)}
              className="text-amber-400 hover:text-amber-200"
            >
              ✕
            </button>
          </div>
          <p className="text-slate-400">
            In accordance with production analysis rules, binary assets, lockfiles, and oversized files are omitted to ensure high signal-to-noise ratio:
          </p>
          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2">
            {repo.skipped_files.map((sf, idx) => (
              <div key={idx} className="flex justify-between font-mono text-[11px] bg-slate-900/80 p-1.5 rounded border border-slate-800">
                <span className="text-slate-300 truncate max-w-md">{sf.path}</span>
                <span className="text-amber-400/90 shrink-0">{sf.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Code Browser split screen: File Tree + Monaco Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[650px] rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-2xl">
        {/* Left Column: File Tree list */}
        <div className="lg:col-span-1 border-r border-slate-800 flex flex-col h-full bg-[#0E131F]">
          <div className="p-3 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Repository Files</span>
            <span className="text-slate-500 font-mono text-[11px]">{files.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {files.map((file) => {
              const isSelected = selectedFile?.id === file.id;
              return (
                <button
                  key={file.id}
                  onClick={() => handleSelectFile(file)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center justify-between transition-colors ${
                    isSelected
                      ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCode className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{file.path}</span>
                  </div>
                  <span className="text-[10px] text-slate-600 shrink-0 font-sans">
                    {file.line_count}L
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: File Header + Monaco Editor */}
        <div className="lg:col-span-3 flex flex-col h-full bg-[#0B0F17]">
          {/* File bar */}
          <div className="h-10 px-4 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400 bg-slate-900/50">
            <span className="text-slate-200 truncate">{selectedFile?.path || "No file selected"}</span>
            {selectedFile && (
              <div className="flex items-center gap-3 text-[11px] text-slate-500 font-sans">
                <span>{selectedFile.language || "text"}</span>
                <span>•</span>
                <span>{selectedFile.line_count} lines</span>
                <span>•</span>
                <span>{selectedFile.functions_count} functions</span>
              </div>
            )}
          </div>

          {/* Monaco Editor Container */}
          <div className="flex-1 w-full overflow-hidden">
            <MonacoEditor
              height="100%"
              language={mapLangToMonaco(selectedFile?.language)}
              value={fileContent}
              theme="vs-dark"
              options={{
                readOnly: true,
                fontSize: 13,
                fontFamily: "JetBrains Mono, Menlo, monospace",
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                wordWrap: "on",
                automaticLayout: true,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
