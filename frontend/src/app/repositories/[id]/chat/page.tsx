"use client";

import { useEffect, useState, useRef, use } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Sparkles,
  Bot,
  User,
  FileCode,
  ArrowRight,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { ChatMessage, Repository } from "@/lib/types";

const SUGGESTED_PROMPTS = [
  "Explain this project and its core architectural design.",
  "Where is the database connection and how are models structured?",
  "Explain the main API endpoints and routing logic.",
  "How does authentication and authorization work?",
  "Find possible performance bottlenecks or unoptimized queries.",
  "How can I add a new feature to this codebase?",
];

export default function RepoChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const repoId = resolvedParams.id;

  const [repo, setRepo] = useState<Repository | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getRepository(repoId).then(setRepo).catch(console.error);
    api.getChatHistory(repoId).then(setMessages).catch(console.error);
  }, [repoId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = async (queryText?: string) => {
    const text = (queryText || input).trim();
    if (!text || sending) return;

    setInput("");
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      sources: [],
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const resp = await api.sendChatMessage(repoId, text);
      setMessages((prev) => [...prev, resp]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `**Error:** ${err?.message || "Failed to process question."}`,
        sources: [],
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-230px)] rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-2xl">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="py-12 max-w-xl mx-auto text-center space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center mx-auto text-white shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Ask anything about {repo?.name || "this codebase"}
              </h2>
              <p className="text-xs text-slate-400 mt-1.5">
                Every answer is grounded strictly in indexed repository files and verified with source line numbers.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left pt-2">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(prompt)}
                  className="p-3 rounded-xl border border-slate-800 bg-slate-800/40 hover:bg-slate-800/80 text-xs text-slate-300 hover:text-white transition-all text-left flex items-start justify-between group"
                >
                  <span className="line-clamp-2">{prompt}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-indigo-400 shrink-0 ml-2 mt-0.5" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3.5 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-2xl rounded-2xl p-4 text-xs md:text-sm ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-sm shadow-md"
                    : "bg-[#0E131F] border border-slate-800 text-slate-200 rounded-bl-sm space-y-4"
                }`}
              >
                {/* Content */}
                <div className="prose prose-invert prose-xs max-w-none leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>

                {/* Sources / Citations */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="pt-3 border-t border-slate-800/80 space-y-2">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                      Cited Source Code References:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {msg.sources.map((src, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300"
                        >
                          <div className="text-indigo-300 font-medium truncate">
                            {src.file_path}
                          </div>
                          <div className="text-slate-500 text-[10px]">
                            Lines {src.start_line}-{src.end_line}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Follow up questions */}
                {msg.follow_up_questions && msg.follow_up_questions.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                    {msg.follow_up_questions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(q)}
                        className="px-2.5 py-1 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-300 text-[11px] transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {/* Copy button */}
                {msg.role === "assistant" && (
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy markdown</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}

        {sending && (
          <div className="flex gap-3.5 justify-start">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
              <Bot className="w-4 h-4" />
            </div>
            <div className="rounded-2xl bg-[#0E131F] border border-slate-800 p-4 text-xs text-slate-400 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>Searching vector index and synthesizing answer...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input box */}
      <div className="p-3 md:p-4 bg-[#0E131F] border-t border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about authentication, routes, data models, or performance..."
            className="flex-1 px-4 py-3 bg-[#0B0F17] border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            disabled={sending}
          />

          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-md transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
