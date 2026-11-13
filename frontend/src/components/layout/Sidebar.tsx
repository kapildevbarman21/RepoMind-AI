"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GitBranchPlus,
  FolderGit2,
  MessageSquareCode,
  Network,
  ShieldAlert,
  BookOpen,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigationItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Analyze Repository", href: "/analyze", icon: GitBranchPlus },
  { name: "My Repositories", href: "/repositories", icon: FolderGit2 },
  { name: "AI Chat", href: "/chat", icon: MessageSquareCode },
  { name: "Architecture Explorer", href: "/architecture", icon: Network },
  { name: "Security Analysis", href: "/security", icon: ShieldAlert },
  { name: "Documentation", href: "/documentation", icon: BookOpen },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-[#0E131F] flex flex-col justify-between shrink-0 h-screen sticky top-0">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800/80 gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white text-base tracking-tight flex items-center gap-1.5">
              RepoMind <span className="text-xs bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded font-mono font-medium">AI</span>
            </div>
            <div className="text-[11px] text-slate-400 tracking-wide font-medium">Code Intelligence</div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1 mt-2">
          {navigationItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                )}
              >
                <item.icon className={cn("w-4 h-4", isActive ? "text-indigo-400" : "text-slate-400")} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Info / Version */}
      <div className="p-4 border-t border-slate-800/80">
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Engine Online
            </span>
            <span className="text-slate-500 font-mono text-[10px]">v1.0.0</span>
          </div>
          <div className="text-[11px] text-slate-400">Tree-sitter AST & pgvector active</div>
        </div>
      </div>
    </aside>
  );
}
