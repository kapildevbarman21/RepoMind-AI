import hashlib
from typing import List, Dict, Any
from app.services.parser.tree_sitter_parser import ParsedFileInfo

class Chunk:
    def __init__(
        self,
        file_path: str,
        language: str,
        chunk_type: str, # 'function', 'class', 'module', 'block'
        name: str,
        start_line: int,
        end_line: int,
        content: str,
        content_hash: str
    ):
        self.file_path = file_path
        self.language = language
        self.chunk_type = chunk_type
        self.name = name
        self.start_line = start_line
        self.end_line = end_line
        self.content = content
        self.content_hash = content_hash

    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_path": self.file_path,
            "language": self.language,
            "chunk_type": self.chunk_type,
            "name": self.name,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "content": self.content,
            "content_hash": self.content_hash,
        }

class SemanticChunker:
    @staticmethod
    def chunk_file(parsed_file: ParsedFileInfo, max_lines_per_chunk: int = 80, overlap: int = 15) -> List[Chunk]:
        """
        Creates semantic chunks based on functions/classes or sliding windows.
        """
        chunks: List[Chunk] = []
        if not parsed_file.raw_content:
            return chunks

        lines = parsed_file.raw_content.splitlines()
        total_lines = len(lines)
        if total_lines == 0:
            return chunks

        covered_lines = set()

        # 1. Chunk identified AST functions and classes
        entities = sorted(
            parsed_file.classes + parsed_file.functions,
            key=lambda e: (e.start_line, -(e.end_line - e.start_line))
        )

        for entity in entities:
            # Bound start and end
            start = max(1, entity.start_line)
            end = min(total_lines, entity.end_line)
            if start > end:
                continue

            entity_lines = lines[start - 1 : end]
            entity_text = "\n".join(entity_lines)
            
            # If function/class is too large (> 120 lines), break it down
            if len(entity_lines) > 120:
                for sub_i in range(0, len(entity_lines), max_lines_per_chunk - overlap):
                    sub_slice = entity_lines[sub_i : sub_i + max_lines_per_chunk]
                    if not sub_slice:
                        break
                    sub_start = start + sub_i
                    sub_end = min(end, sub_start + len(sub_slice) - 1)
                    sub_text = "\n".join(sub_slice)
                    formatted_content = f"// File: {parsed_file.rel_path} (Lines {sub_start}-{sub_end})\n{sub_text}"
                    ch_hash = hashlib.sha256(formatted_content.encode("utf-8")).hexdigest()
                    chunks.append(Chunk(
                        file_path=parsed_file.rel_path,
                        language=parsed_file.language,
                        chunk_type=entity.entity_type,
                        name=f"{entity.name} (part)",
                        start_line=sub_start,
                        end_line=sub_end,
                        content=formatted_content,
                        content_hash=ch_hash
                    ))
            else:
                formatted_content = f"// File: {parsed_file.rel_path} (Lines {start}-{end})\n{entity_text}"
                ch_hash = hashlib.sha256(formatted_content.encode("utf-8")).hexdigest()
                chunks.append(Chunk(
                    file_path=parsed_file.rel_path,
                    language=parsed_file.language,
                    chunk_type=entity.entity_type,
                    name=entity.name,
                    start_line=start,
                    end_line=end,
                    content=formatted_content,
                    content_hash=ch_hash
                ))

            for l in range(start, end + 1):
                covered_lines.add(l)

        # 2. Chunk remaining uncovered lines (module-level code, imports, configs)
        uncovered_start = 1
        while uncovered_start <= total_lines:
            # Check if this line is covered
            if uncovered_start in covered_lines and len(entities) > 0:
                uncovered_start += 1
                continue

            uncovered_end = min(total_lines, uncovered_start + max_lines_per_chunk)
            sub_slice = lines[uncovered_start - 1 : uncovered_end]
            sub_text = "\n".join(sub_slice).strip()
            
            if sub_text:
                formatted_content = f"// File: {parsed_file.rel_path} (Lines {uncovered_start}-{uncovered_end})\n{sub_text}"
                ch_hash = hashlib.sha256(formatted_content.encode("utf-8")).hexdigest()
                chunks.append(Chunk(
                    file_path=parsed_file.rel_path,
                    language=parsed_file.language,
                    chunk_type="block",
                    name=f"{parsed_file.name}:{uncovered_start}",
                    start_line=uncovered_start,
                    end_line=uncovered_end,
                    content=formatted_content,
                    content_hash=ch_hash
                ))

            uncovered_start += max(1, max_lines_per_chunk - overlap)

        return chunks
