"use client";

import { useEffect, useState, useMemo, use } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Search,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { ArchitectureData } from "@/lib/types";

// Custom Node Component
function CustomArchitectureNode({ data }: NodeProps) {
  const nodeData = data as any;
  const typeColors: Record<string, string> = {
    entrypoint: "border-emerald-500/80 bg-emerald-950/40 text-emerald-300",
    route: "border-sky-500/80 bg-sky-950/40 text-sky-300",
    service: "border-indigo-500/80 bg-indigo-950/40 text-indigo-300",
    model: "border-purple-500/80 bg-purple-950/40 text-purple-300",
    ui: "border-pink-500/80 bg-pink-950/40 text-pink-300",
    utility: "border-amber-500/80 bg-amber-950/40 text-amber-300",
    config: "border-slate-500/80 bg-slate-800 text-slate-300",
  };

  const badgeColor = typeColors[nodeData.type] || "border-indigo-500 bg-slate-900 text-indigo-300";

  return (
    <div className={`px-4 py-3 rounded-xl border-2 shadow-lg min-w-[190px] bg-[#0E131F] ${badgeColor} transition-all hover:scale-105`}>
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 !bg-indigo-400" />
      <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider mb-1 opacity-80">
        <span>{nodeData.type}</span>
        <span>{nodeData.lineCount}L</span>
      </div>
      <div className="font-semibold text-xs text-white truncate max-w-[170px]">
        {nodeData.label}
      </div>
      <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
        {nodeData.filePath}
      </div>
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 !bg-indigo-400" />
    </div>
  );
}

const nodeTypes = {
  custom: CustomArchitectureNode,
};

export default function ArchitectureExplorerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const repoId = resolvedParams.id;

  const [archData, setArchData] = useState<ArchitectureData | null>(null);
  const [, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [selectedNode, setSelectedNode] = useState<any>(null);

  useEffect(() => {
    api.getRepositoryArchitecture(repoId).then((data) => {
      setArchData(data);
      setNodes(data.nodes as any);
      setEdges(data.edges as any);
    }).catch(console.error);
  }, [repoId, setNodes, setEdges]);

  // Filter nodes based on tier and search
  const filteredNodes = useMemo(() => {
    if (!archData) return [];
    return archData.nodes.filter((n) => {
      const matchSearch =
        n.data.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.data.filePath.toLowerCase().includes(searchTerm.toLowerCase());
      const matchTier = selectedTier === "ALL" || n.data.type === selectedTier;
      return matchSearch && matchTier;
    });
  }, [archData, searchTerm, selectedTier]);

  return (
    <div className="space-y-4">
      {/* Narrative Architecture Summary */}
      {archData?.summary && (
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-slate-300 flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">System Architecture Overview: </span>
            <span>{archData.summary}</span>
          </div>
        </div>
      )}

      {/* Control bar: Search + Tier filters */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search architecture nodes..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#0B0F17] border border-slate-700/80 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Tiers filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
          {["ALL", "entrypoint", "route", "service", "model", "ui"].map((tier) => (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider transition-colors ${
                selectedTier === tier
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800/80 text-slate-400 hover:text-slate-200"
              }`}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      {/* React Flow Canvas and Detail Drawer */}
      <div className="relative h-[650px] rounded-2xl bg-[#090D14] border border-slate-800 overflow-hidden shadow-2xl">
        <ReactFlow
          nodes={filteredNodes as any}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node: any) => setSelectedNode(node.data)}
          fitView
        >
          <Background color="#1E293B" gap={20} />
          <Controls className="!bg-slate-900 !border-slate-800 !text-white" />
          <MiniMap
            nodeColor="#6366F1"
            maskColor="rgba(11, 15, 23, 0.85)"
            className="!bg-[#0E131F] !border !border-slate-800 rounded-lg overflow-hidden"
          />
        </ReactFlow>

        {/* Selected Component Detail Drawer */}
        {selectedNode && (
          <div className="absolute right-4 top-4 bottom-4 w-80 rounded-xl bg-[#0E131F]/95 backdrop-blur border border-slate-700 p-4 shadow-2xl overflow-y-auto space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                  {selectedNode.type}
                </span>
                <h3 className="font-bold text-white text-sm">{selectedNode.label}</h3>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-[220px]">
                  {selectedNode.filePath}
                </div>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-slate-500 hover:text-slate-300 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs border-t border-slate-800 pt-3">
              <div>
                <span className="text-slate-400 font-medium">Metrics:</span>
                <div className="grid grid-cols-2 gap-2 mt-1 font-mono text-[11px]">
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    Lines: <span className="text-white">{selectedNode.lineCount}</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    Functions: <span className="text-white">{selectedNode.functionsCount}</span>
                  </div>
                </div>
              </div>

              {selectedNode.functions && selectedNode.functions.length > 0 && (
                <div>
                  <span className="text-slate-400 font-medium">Key Functions:</span>
                  <div className="mt-1 space-y-1">
                    {selectedNode.functions.map((fn: string, i: number) => (
                      <div key={i} className="text-[11px] font-mono text-indigo-300 bg-indigo-950/30 px-2 py-1 rounded border border-indigo-500/20 truncate">
                        {fn}()
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedNode.classes && selectedNode.classes.length > 0 && (
                <div>
                  <span className="text-slate-400 font-medium">Declared Classes:</span>
                  <div className="mt-1 space-y-1">
                    {selectedNode.classes.map((cls: string, i: number) => (
                      <div key={i} className="text-[11px] font-mono text-purple-300 bg-purple-950/30 px-2 py-1 rounded border border-purple-500/20 truncate">
                        class {cls}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
