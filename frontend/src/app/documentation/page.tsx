"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, FolderGit2, ArrowRight, GitBranchPlus } from "lucide-react";
import { api } from "@/lib/api";
import { Repository } from "@/lib/types";

export default function GlobalDocumentationPage() {
  const router = useRouter();
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getRepositories(0, 10).then((data) => {
      setRepos(data);
      if (data.length === 1) {
        router.push(`/repositories/${data[0].id}/documentation`);
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mx-auto text-violet-400">
          <BookOpen className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Generated Documentation</h1>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Export READMEs, API specifications, and onboarding walkthroughs.
        </p>
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-900/60 border border-slate-800" />
          ))}
        </div>
      ) : repos.length > 0 ? (
        <div className="space-y-2">
          {repos.map((repo) => (
            <Link
              key={repo.id}
              href={`/repositories/${repo.id}/documentation`}
              className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-violet-500/50 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <FolderGit2 className="w-4 h-4 text-violet-400" />
                <div>
                  <div className="font-semibold text-sm text-white group-hover:text-violet-300 transition-colors">
                    {repo.full_name}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {repo.total_files} files • Markdown ready
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-violet-400 transition-colors" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/40 space-y-3">
          <BookOpen className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="font-semibold text-white text-sm">No repositories indexed yet</h3>
          <Link
            href="/analyze"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <GitBranchPlus className="w-3.5 h-3.5" />
            <span>Analyze Repository</span>
          </Link>
        </div>
      )}
    </div>
  );
}
