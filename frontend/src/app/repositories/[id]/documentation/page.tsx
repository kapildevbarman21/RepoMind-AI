"use client";

import { useEffect, useState, use } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText,
  Copy,
  Check,
  Download,
} from "lucide-react";
import { api } from "@/lib/api";
import { DocumentationItem } from "@/lib/types";

export default function DocumentationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const repoId = resolvedParams.id;

  const [docs, setDocs] = useState<DocumentationItem[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentationItem | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.getRepositoryDocumentation(repoId).then((data) => {
      setDocs(data);
      if (data.length > 0) {
        setSelectedDoc(data[0]);
      }
    }).catch(console.error);
  }, [repoId]);

  const handleCopy = () => {
    if (!selectedDoc) return;
    navigator.clipboard.writeText(selectedDoc.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!selectedDoc) return;
    const blob = new Blob([selectedDoc.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedDoc.doc_type.toLowerCase() || "doc"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Left Navigation: Doc Type Selector */}
      <div className="lg:col-span-1 space-y-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block px-2 mb-2">
          Generated Documents
        </span>
        {docs.map((doc) => {
          const isSelected = selectedDoc?.id === doc.id;
          return (
            <button
              key={doc.id}
              onClick={() => setSelectedDoc(doc)}
              className={`w-full text-left p-3 rounded-xl text-xs font-medium transition-all flex items-center justify-between ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "bg-slate-900/70 border border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <FileText className={`w-4 h-4 shrink-0 ${isSelected ? "text-white" : "text-indigo-400"}`} />
                <span className="truncate">{doc.title}</span>
              </div>
              <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                isSelected ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
              }`}>
                {doc.doc_type}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right Column: Markdown Document Previewer & Exporter */}
      <div className="lg:col-span-3 rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-2xl flex flex-col min-h-[650px]">
        {/* Header Bar */}
        <div className="p-4 border-b border-slate-800 bg-[#0E131F] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              {selectedDoc?.title || "Document Preview"}
            </h2>
            <div className="text-xs text-slate-500 font-mono mt-0.5">
              Live Markdown export generated from repository AST
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-colors"
              title="Copy markdown text"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Markdown</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors"
              title="Export as .md file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .md</span>
            </button>
          </div>
        </div>

        {/* Markdown Render Area */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-[#0B0F17] prose prose-invert prose-indigo max-w-none text-slate-200 leading-relaxed">
          {selectedDoc ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {selectedDoc.content}
            </ReactMarkdown>
          ) : (
            <div className="py-20 text-center text-slate-500 text-xs">
              Select a generated document from the sidebar to preview and export.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
