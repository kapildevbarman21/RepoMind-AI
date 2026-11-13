"use client";

import { useEffect, useState, use } from "react";
import {
  ShieldCheck,
  Key,
  Database,
  Terminal,
  Settings,
  FileCode,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { SecurityReport } from "@/lib/types";

export default function SecurityAnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const repoId = resolvedParams.id;

  const [report, setReport] = useState<SecurityReport | null>(null);
  const [, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    api.getRepositorySecurity(repoId).then((data) => {
      setReport(data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [repoId]);

  const filteredFindings = (report?.findings || []).filter((f) => {
    return severityFilter === "ALL" || f.severity === severityFilter;
  });

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
        return "bg-red-500/15 text-red-400 border-red-500/30";
      case "HIGH":
        return "bg-amber-500/15 text-amber-400 border-amber-500/30";
      case "MEDIUM":
        return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
      default:
        return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "SECRET":
        return <Key className="w-4 h-4 text-red-400" />;
      case "INJECTION":
        return <Database className="w-4 h-4 text-amber-400" />;
      case "CONFIGURATION":
        return <Settings className="w-4 h-4 text-yellow-400" />;
      default:
        return <Terminal className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-xs text-slate-400 font-medium">Critical Issues</div>
          <div className="text-2xl font-bold text-red-400 mt-1">
            {report?.critical_count || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Secrets & private keys</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-xs text-slate-400 font-medium">High Severity</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {report?.high_count || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Injections & RCE vectors</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-xs text-slate-400 font-medium">Medium Severity</div>
          <div className="text-2xl font-bold text-yellow-400 mt-1">
            {report?.medium_count || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Permissive configurations</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-xs text-slate-400 font-medium">Total Audited</div>
          <div className="text-2xl font-bold text-white mt-1">
            {report?.total_findings || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Static AST rules executed</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
          <button
            key={sev}
            onClick={() => setSeverityFilter(sev)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wider transition-colors ${
              severityFilter === sev
                ? "bg-indigo-600 text-white"
                : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            {sev}
          </button>
        ))}
      </div>

      {/* Findings List */}
      <div className="space-y-3">
        {filteredFindings.length > 0 ? (
          filteredFindings.map((finding) => {
            const isExpanded = expandedId === finding.id;
            return (
              <div
                key={finding.id}
                className="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-sm transition-all"
              >
                <div
                  onClick={() => setExpandedId(isExpanded ? null : finding.id)}
                  className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-800/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-slate-800/80 shrink-0">
                      {getCategoryIcon(finding.category)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getSeverityBadge(finding.severity)}`}>
                          {finding.severity}
                        </span>
                        <h4 className="font-semibold text-white text-sm truncate">
                          {finding.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-1">
                        <FileCode className="w-3.5 h-3.5 text-slate-500" />
                        <span className="truncate">{finding.file_path}:{finding.line_number}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-[11px] text-slate-500 font-sans">
                          {finding.is_confirmed ? "Confirmed" : "Potential risk"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-slate-500">
                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </div>
                </div>

                {/* Expanded Details: Evidence snippet & suggested remediation */}
                {isExpanded && (
                  <div className="p-4 border-t border-slate-800/80 bg-[#0B0F17]/90 space-y-4 text-xs">
                    <div>
                      <span className="font-semibold text-slate-300">Vulnerability Description:</span>
                      <p className="text-slate-400 mt-0.5 leading-relaxed">{finding.description}</p>
                    </div>

                    {finding.code_snippet && (
                      <div>
                        <span className="font-semibold text-slate-300">Matched Evidence:</span>
                        <pre className="mt-1 p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-red-300 overflow-x-auto">
                          {finding.code_snippet}
                        </pre>
                      </div>
                    )}

                    {finding.suggested_remediation && (
                      <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-emerald-300">
                        <span className="font-semibold block mb-0.5">Remediation Action:</span>
                        <span className="text-emerald-200/90">{finding.suggested_remediation}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="py-16 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
            <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="font-bold text-white text-base">No Security Vulnerabilities Detected</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Zero security findings match the selected filter. Clean static analysis audit passed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
