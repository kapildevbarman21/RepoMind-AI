import os
import re
from typing import List, Dict, Any, Tuple
from app.services.parser.tree_sitter_parser import ParsedFileInfo

class ArchitectureService:
    @staticmethod
    def classify_file_type(rel_path: str, content: str) -> str:
        """
        Classifies a file into an architectural component tier.
        """
        path_lower = rel_path.lower()
        base_name = os.path.basename(path_lower)
        
        # Entrypoints
        if base_name in ("main.py", "app.py", "server.js", "server.ts", "index.ts", "index.js", "main.go", "manage.py"):
            return "entrypoint"
            
        # API / Routes
        if any(seg in path_lower for seg in ("api", "route", "routes", "controller", "controllers", "endpoint", "endpoints")):
            return "route"
            
        # Database / Models
        if any(seg in path_lower for seg in ("model", "models", "schema", "schemas", "entity", "entities", "db", "database", "migration")):
            return "model"
            
        # UI / Frontend
        if any(seg in path_lower for seg in ("component", "components", "pages", "views", "ui", "layout", "styles")):
            return "ui"
        if base_name.endswith((".tsx", ".jsx", ".vue", ".svelte")):
            return "ui"
            
        # Services
        if any(seg in path_lower for seg in ("service", "services", "domain", "logic", "handler", "handlers", "worker", "workers")):
            return "service"
            
        # Configuration
        if any(seg in path_lower for seg in ("config", "settings", "env")) or base_name.endswith((".yaml", ".yml", ".toml", ".json", ".ini")):
            return "config"
            
        # Utilities
        if any(seg in path_lower for seg in ("util", "utils", "helper", "helpers", "common", "lib")):
            return "utility"
            
        return "service"

    @classmethod
    def build_architecture_graph(cls, parsed_files: List[ParsedFileInfo], repo_name: str) -> Dict[str, Any]:
        """
        Builds React Flow compatible nodes, edges, and component summaries
        from real parsed repository files and import relationships.
        """
        nodes: List[Dict[str, Any]] = []
        edges: List[Dict[str, Any]] = []
        file_map: Dict[str, str] = {} # stem/module_name -> node_id
        
        tier_counts = {
            "entrypoint": 0,
            "route": 0,
            "service": 0,
            "model": 0,
            "ui": 0,
            "utility": 0,
            "config": 0
        }

        # Filter out trivial files (e.g. tests or config if repository is large)
        significant_files = [
            f for f in parsed_files
            if not any(k in f.rel_path.lower() for k in ("test", "spec", ".test.", "__tests__", "fixture"))
        ]
        
        # If too few, use all files
        if len(significant_files) < 3:
            significant_files = parsed_files

        # Cap nodes at 50 for interactive UI performance
        selected_files = significant_files[:45]

        # Tier placement column mapping
        tier_columns = {
            "entrypoint": 0,
            "route": 1,
            "service": 2,
            "model": 3,
            "ui": 0,
            "utility": 2,
            "config": 3
        }
        
        tier_y_offsets = {k: 50 for k in tier_columns}

        for file_info in selected_files:
            node_id = f"node_{file_info.rel_path.replace('/', '_').replace('.', '_')}"
            comp_type = cls.classify_file_type(file_info.rel_path, file_info.raw_content or "")
            tier_counts[comp_type] = tier_counts.get(comp_type, 0) + 1
            
            col = tier_columns.get(comp_type, 1)
            x_pos = 50 + (col * 320)
            y_pos = tier_y_offsets[comp_type]
            tier_y_offsets[comp_type] += 120

            # Map stems and filenames for import edge resolution
            file_stem = os.path.splitext(os.path.basename(file_info.rel_path))[0]
            file_map[file_info.rel_path] = node_id
            file_map[file_stem] = node_id
            file_map[os.path.basename(file_info.rel_path)] = node_id

            nodes.append({
                "id": node_id,
                "type": "custom",
                "position": {"x": x_pos, "y": y_pos},
                "data": {
                    "label": file_info.name,
                    "filePath": file_info.rel_path,
                    "type": comp_type,
                    "language": file_info.language,
                    "lineCount": file_info.line_count,
                    "functionsCount": len(file_info.functions),
                    "classesCount": len(file_info.classes),
                    "functions": [f.name for f in file_info.functions[:5]],
                    "classes": [c.name for c in file_info.classes[:3]]
                }
            })

        # Build Edges based on real import statements
        edge_set = set()
        for file_info in selected_files:
            source_id = file_map.get(file_info.rel_path)
            if not source_id:
                continue

            for imp in file_info.imports:
                imp_clean = imp.replace("from ", "").replace("import ", "").replace("require(", "").replace(")", "").replace(";", "").replace('"', '').replace("'", "").strip()
                tokens = re.split(r"[\s,\./\\]+", imp_clean)
                
                for token in tokens:
                    if not token or len(token) < 2:
                        continue
                    if token in file_map:
                        target_id = file_map[token]
                        if source_id != target_id:
                            edge_key = f"{source_id}->{target_id}"
                            if edge_key not in edge_set:
                                edge_set.add(edge_key)
                                edges.append({
                                    "id": f"e_{source_id}_{target_id}",
                                    "source": source_id,
                                    "target": target_id,
                                    "animated": True,
                                    "relation": "imports",
                                    "label": "imports",
                                    "style": {"stroke": "#818cf8", "strokeWidth": 2}
                                })

        # Architectural summary narrative
        summary = (
            f"Repository '{repo_name}' is organized into {len(selected_files)} analyzed core modules. "
            f"It comprises {tier_counts['entrypoint']} entry points, {tier_counts['route']} API/routes, "
            f"{tier_counts['service']} service components, {tier_counts['model']} models/schemas, "
            f"and {tier_counts['ui']} user interface modules, interconnected via {len(edges)} detected import dependencies."
        )

        return {
            "repository_name": repo_name,
            "summary": summary,
            "nodes": nodes,
            "edges": edges,
            "components_breakdown": tier_counts
        }
