import os
import re
import hashlib
from typing import Dict, Any, List, Optional, Tuple
from tree_sitter import Language, Parser

# Import language modules
import tree_sitter_python as tspython
import tree_sitter_javascript as tsjs
import tree_sitter_typescript as tsts
import tree_sitter_go as tsgo
import tree_sitter_rust as tsrust
import tree_sitter_java as tsjava
import tree_sitter_c as tsc
import tree_sitter_cpp as tscpp

# Initialize language parsers
PARSERS: Dict[str, Parser] = {}

try:
    PARSERS["python"] = Parser(Language(tspython.language()))
    PARSERS["javascript"] = Parser(Language(tsjs.language()))
    PARSERS["typescript"] = Parser(Language(tsts.language_typescript()))
    PARSERS["tsx"] = Parser(Language(tsts.language_tsx()))
    PARSERS["go"] = Parser(Language(tsgo.language()))
    PARSERS["rust"] = Parser(Language(tsrust.language()))
    PARSERS["java"] = Parser(Language(tsjava.language()))
    PARSERS["c"] = Parser(Language(tsc.language()))
    PARSERS["cpp"] = Parser(Language(tscpp.language()))
except Exception as e:
    print(f"[Warning] Failed to initialize some tree-sitter parsers: {e}")

# Mapping extensions to language
EXT_MAP = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".hpp": "cpp",
    ".cc": "cpp",
    ".rb": "ruby",
    ".php": "php",
    ".kt": "kotlin",
    ".swift": "swift",
    ".sql": "sql",
    ".sh": "bash",
    ".bash": "bash",
    ".zsh": "bash",
    ".html": "html",
    ".css": "css",
    ".scss": "scss",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".md": "markdown",
    ".toml": "toml",
}

IGNORED_DIRS = {
    ".git", ".github", "node_modules", "__pycache__", "venv", ".venv",
    "env", ".env", "dist", "build", ".next", ".nuxt", "out", "target",
    "vendor", ".idea", ".vscode", "coverage", ".pytest_cache", ".mypy_cache",
    "bin", "obj", ".turbo", ".cache"
}

BINARY_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".zip", ".tar", ".gz", ".rar", ".7z", ".pdf",
    ".exe", ".dll", ".so", ".dylib", ".bin", ".iso",
    ".mp3", ".mp4", ".wav", ".avi", ".mov",
    ".lock", ".lockb", ".pyc", ".pyo", ".pyd", ".class", ".jar"
}

class CodeEntity:
    def __init__(
        self,
        name: str,
        entity_type: str, # 'function', 'class', 'interface', 'struct'
        start_line: int,
        end_line: int,
        docstring: Optional[str] = None
    ):
        self.name = name
        self.entity_type = entity_type
        self.start_line = start_line
        self.end_line = end_line
        self.docstring = docstring

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "entity_type": self.entity_type,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "docstring": self.docstring
        }

class ParsedFileInfo:
    def __init__(
        self,
        rel_path: str,
        name: str,
        extension: str,
        language: str,
        size_bytes: int,
        line_count: int,
        sha256_hash: str,
        is_binary: bool = False,
        functions: Optional[List[CodeEntity]] = None,
        classes: Optional[List[CodeEntity]] = None,
        imports: Optional[List[str]] = None,
        exports: Optional[List[str]] = None,
        raw_content: Optional[str] = None
    ):
        self.rel_path = rel_path
        self.name = name
        self.extension = extension
        self.language = language
        self.size_bytes = size_bytes
        self.line_count = line_count
        self.sha256_hash = sha256_hash
        self.is_binary = is_binary
        self.functions = functions or []
        self.classes = classes or []
        self.imports = imports or []
        self.exports = exports or []
        self.raw_content = raw_content

def detect_language(filename: str) -> Optional[str]:
    _, ext = os.path.splitext(filename.lower())
    if ext in EXT_MAP:
        return EXT_MAP[ext]
    if filename.lower() == "dockerfile":
        return "dockerfile"
    if filename.lower() == "makefile":
        return "makefile"
    return None

class CodebaseParser:
    @staticmethod
    def parse_python_ast(source_bytes: bytes) -> Tuple[List[CodeEntity], List[CodeEntity], List[str]]:
        functions = []
        classes = []
        imports = []
        
        parser = PARSERS.get("python")
        if not parser:
            return functions, classes, imports
            
        tree = parser.parse(source_bytes)
        
        def traverse(node):
            if node.type in ("function_definition", "async_function_definition"):
                name_node = node.child_by_field_name("name")
                name = name_node.text.decode("utf-8", errors="ignore") if name_node else "anonymous"
                functions.append(CodeEntity(
                    name=name,
                    entity_type="function",
                    start_line=node.start_point.row + 1,
                    end_line=node.end_point.row + 1
                ))
            elif node.type == "class_definition":
                name_node = node.child_by_field_name("name")
                name = name_node.text.decode("utf-8", errors="ignore") if name_node else "anonymous"
                classes.append(CodeEntity(
                    name=name,
                    entity_type="class",
                    start_line=node.start_point.row + 1,
                    end_line=node.end_point.row + 1
                ))
            elif node.type == "import_statement":
                raw = node.text.decode("utf-8", errors="ignore").strip()
                imports.append(raw)
            elif node.type == "import_from_statement":
                mod_node = node.child_by_field_name("module_name")
                mod = mod_node.text.decode("utf-8", errors="ignore") if mod_node else ""
                imports.append(f"from {mod}")
                
            for child in node.children:
                traverse(child)

        traverse(tree.root_node)
        return functions, classes, imports

    @staticmethod
    def parse_js_ts_ast(source_bytes: bytes, lang: str) -> Tuple[List[CodeEntity], List[CodeEntity], List[str]]:
        functions = []
        classes = []
        imports = []
        
        parser = PARSERS.get(lang, PARSERS.get("javascript"))
        if not parser:
            return functions, classes, imports
            
        tree = parser.parse(source_bytes)
        
        def traverse(node):
            if node.type in ("function_declaration", "method_definition"):
                name_node = node.child_by_field_name("name")
                name = name_node.text.decode("utf-8", errors="ignore") if name_node else "anonymous"
                functions.append(CodeEntity(
                    name=name,
                    entity_type="function",
                    start_line=node.start_point.row + 1,
                    end_line=node.end_point.row + 1
                ))
            elif node.type in ("class_declaration", "interface_declaration"):
                name_node = node.child_by_field_name("name")
                name = name_node.text.decode("utf-8", errors="ignore") if name_node else "anonymous"
                classes.append(CodeEntity(
                    name=name,
                    entity_type="class" if node.type == "class_declaration" else "interface",
                    start_line=node.start_point.row + 1,
                    end_line=node.end_point.row + 1
                ))
            elif node.type == "import_statement":
                raw = node.text.decode("utf-8", errors="ignore").strip()
                imports.append(raw)
                
            for child in node.children:
                traverse(child)

        traverse(tree.root_node)
        return functions, classes, imports

    @staticmethod
    def parse_go_ast(source_bytes: bytes) -> Tuple[List[CodeEntity], List[CodeEntity], List[str]]:
        functions = []
        classes = []
        imports = []
        
        parser = PARSERS.get("go")
        if not parser:
            return functions, classes, imports
            
        tree = parser.parse(source_bytes)
        
        def traverse(node):
            if node.type in ("function_declaration", "method_declaration"):
                name_node = node.child_by_field_name("name")
                name = name_node.text.decode("utf-8", errors="ignore") if name_node else "anonymous"
                functions.append(CodeEntity(
                    name=name,
                    entity_type="function",
                    start_line=node.start_point.row + 1,
                    end_line=node.end_point.row + 1
                ))
            elif node.type == "type_spec":
                name_node = node.child_by_field_name("name")
                name = name_node.text.decode("utf-8", errors="ignore") if name_node else "anonymous"
                classes.append(CodeEntity(
                    name=name,
                    entity_type="struct",
                    start_line=node.start_point.row + 1,
                    end_line=node.end_point.row + 1
                ))
            elif node.type == "import_spec":
                raw = node.text.decode("utf-8", errors="ignore").strip()
                imports.append(raw)
                
            for child in node.children:
                traverse(child)

        traverse(tree.root_node)
        return functions, classes, imports

    @staticmethod
    def parse_rust_ast(source_bytes: bytes) -> Tuple[List[CodeEntity], List[CodeEntity], List[str]]:
        functions = []
        classes = []
        imports = []
        
        parser = PARSERS.get("rust")
        if not parser:
            return functions, classes, imports
            
        tree = parser.parse(source_bytes)
        
        def traverse(node):
            if node.type == "function_item":
                name_node = node.child_by_field_name("name")
                name = name_node.text.decode("utf-8", errors="ignore") if name_node else "anonymous"
                functions.append(CodeEntity(
                    name=name,
                    entity_type="function",
                    start_line=node.start_point.row + 1,
                    end_line=node.end_point.row + 1
                ))
            elif node.type in ("struct_item", "trait_item", "enum_item"):
                name_node = node.child_by_field_name("name")
                name = name_node.text.decode("utf-8", errors="ignore") if name_node else "anonymous"
                classes.append(CodeEntity(
                    name=name,
                    entity_type="struct",
                    start_line=node.start_point.row + 1,
                    end_line=node.end_point.row + 1
                ))
            elif node.type == "use_declaration":
                imports.append(node.text.decode("utf-8", errors="ignore").strip())
                
            for child in node.children:
                traverse(child)

        traverse(tree.root_node)
        return functions, classes, imports

    @staticmethod
    def parse_fallback(content: str, language: str) -> Tuple[List[CodeEntity], List[CodeEntity], List[str]]:
        """Graceful regex-based structural parser for unsupported or fallback languages."""
        functions = []
        classes = []
        imports = []
        
        lines = content.splitlines()
        for idx, line in enumerate(lines):
            line_no = idx + 1
            stripped = line.strip()
            
            # Match class / struct
            class_match = re.search(r"^(?:public\s+|private\s+|abstract\s+)?(?:class|interface|struct|record)\s+([a-zA-Z0-9_]+)", stripped)
            if class_match:
                classes.append(CodeEntity(
                    name=class_match.group(1),
                    entity_type="class",
                    start_line=line_no,
                    end_line=line_no + 10
                ))
                continue
                
            # Match function / method
            func_match = re.search(r"^(?:def|func|function|fn|sub|public\s+function|fun)\s+([a-zA-Z0-9_]+)", stripped)
            if func_match:
                functions.append(CodeEntity(
                    name=func_match.group(1),
                    entity_type="function",
                    start_line=line_no,
                    end_line=line_no + 10
                ))
                continue
                
            # Match imports
            if stripped.startswith(("import ", "from ", "require(", "include ", "use ", "package ")):
                imports.append(stripped)
                
        return functions, classes, imports

    @classmethod
    def parse_file(cls, repo_root: str, abs_path: str, max_file_size_bytes: int) -> Tuple[Optional[ParsedFileInfo], Optional[str]]:
        """
        Parses a single file. Returns (ParsedFileInfo, skip_reason).
        """
        rel_path = os.path.relpath(abs_path, repo_root)
        name = os.path.basename(abs_path)
        _, ext = os.path.splitext(name.lower())
        
        # Check binary
        if ext in BINARY_EXTENSIONS:
            return None, f"Skipped binary file ({ext})"
            
        file_size = os.path.getsize(abs_path)
        if file_size > max_file_size_bytes:
            return None, f"File exceeds maximum allowed size ({round(file_size/1024, 1)} KB > {round(max_file_size_bytes/1024)} KB)"
            
        try:
            with open(abs_path, "rb") as f:
                raw_bytes = f.read()
                
            # Check for null bytes (binary file check)
            if b"\x00" in raw_bytes[:1024]:
                return None, "Skipped binary file (null bytes detected)"
                
            content = raw_bytes.decode("utf-8", errors="replace")
            line_count = len(content.splitlines())
            sha256 = hashlib.sha256(raw_bytes).hexdigest()
            language = detect_language(name) or "text"
            
            functions: List[CodeEntity] = []
            classes: List[CodeEntity] = []
            imports: List[str] = []
            
            # Tree-sitter AST parsing based on language
            if language == "python" and "python" in PARSERS:
                functions, classes, imports = cls.parse_python_ast(raw_bytes)
            elif language in ("javascript", "typescript", "tsx") and language in PARSERS:
                functions, classes, imports = cls.parse_js_ts_ast(raw_bytes, language)
            elif language == "go" and "go" in PARSERS:
                functions, classes, imports = cls.parse_go_ast(raw_bytes)
            elif language == "rust" and "rust" in PARSERS:
                functions, classes, imports = cls.parse_rust_ast(raw_bytes)
            else:
                functions, classes, imports = cls.parse_fallback(content, language)
                
            return ParsedFileInfo(
                rel_path=rel_path,
                name=name,
                extension=ext,
                language=language,
                size_bytes=file_size,
                line_count=line_count,
                sha256_hash=sha256,
                is_binary=False,
                functions=functions,
                classes=classes,
                imports=imports,
                exports=[],
                raw_content=content
            ), None
            
        except Exception as e:
            return None, f"Failed to read file: {str(e)}"
