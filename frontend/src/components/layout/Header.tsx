"use client";

import Link from "next/link";
import { GitBranchPlus, ExternalLink } from "lucide-react";
import { GithubIcon } from "@/components/ui/GithubIcon";

export function Header() {
  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#0B0F17]/90 backdrop-blur sticky top-0 z-30 px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="text-sm font-medium text-slate-300">
          Repository Intelligence Platform
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/analyze"
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <GitBranchPlus className="w-3.5 h-3.5" />
          <span>Analyze Repository</span>
        </Link>

        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-colors"
        >
          <GithubIcon className="w-3.5 h-3.5" />
          <span>GitHub</span>
          <ExternalLink className="w-3 h-3 text-slate-500" />
        </a>
      </div>
    </header>
  );
}
