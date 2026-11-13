import os
import shutil
import asyncio
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.entities import (
    Repository, FileItem, CodeChunk, ArchitectureGraph,
    SecurityFinding, DocumentationItem
)
from app.services.github_service import GitHubService, parse_github_url
from app.services.parser.tree_sitter_parser import (
    CodebaseParser, ParsedFileInfo, IGNORED_DIRS
)
from app.services.chunker import SemanticChunker, Chunk
from app.services.embeddings import embedding_engine
from app.services.architecture_service import ArchitectureService
from app.services.security_scanner import SecurityScanner
from app.services.doc_generator import DocumentationGenerator

class AnalysisPipeline:
    @classmethod
    async def run(
        cls,
        repo_id: str,
        branch: Optional[str] = None,
        commit: Optional[str] = None,
        auth_token: Optional[str] = None
    ):
        """
        Executes the full 14-step analysis pipeline asynchronously.
        """
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Repository).where(Repository.id == repo_id))
            repo = result.scalar_one_or_none()
            if not repo:
                return

            repo_dir = os.path.join(settings.REPOS_STORAGE_PATH, repo.id)
            
            try:
                # STEP 1: Repository validation
                repo.status = "CLONING"
                repo.status_message = "Validating repository and connecting to GitHub..."
                repo.progress = 5
                await db.commit()

                owner, repo_name = parse_github_url(repo.url)

                # STEP 2: Secure repository retrieval
                repo.status_message = f"Cloning {owner}/{repo_name} (shallow checkout)..."
                repo.progress = 15
                await db.commit()

                head_sha = await GitHubService.clone_repository(
                    owner=owner,
                    repo=repo_name,
                    target_dir=repo_dir,
                    branch=branch or repo.default_branch,
                    commit=commit,
                    auth_token=auth_token
                )
                repo.commit_sha = head_sha
                if branch:
                    repo.current_branch = branch

                # STEP 3-6: File tree extraction, ignore filtering, classification
                repo.status = "PARSING"
                repo.status_message = "Extracting file tree and filtering irrelevant files..."
                repo.progress = 30
                await db.commit()

                candidate_files = []
                skipped_files = []

                for root, dirs, files in os.walk(repo_dir):
                    # Prune ignored directories
                    dirs[:] = [d for d in dirs if d not in IGNORED_DIRS and not d.startswith(".")]

                    for file in files:
                        abs_p = os.path.join(root, file)
                        candidate_files.append(abs_p)

                # Respect max indexed files limit
                max_files = settings.MAX_INDEXED_FILES
                if len(candidate_files) > max_files:
                    skipped_files.append({
                        "path": f"{len(candidate_files) - max_files} additional files",
                        "reason": f"Exceeded maximum indexed files threshold ({max_files})"
                    })
                    candidate_files = candidate_files[:max_files]

                # STEP 7-8: Parse source code with Tree-sitter AST
                repo.status_message = f"Parsing {len(candidate_files)} source files with Tree-sitter AST..."
                repo.progress = 50
                await db.commit()

                parsed_files: List[ParsedFileInfo] = []
                total_lines = 0
                max_bytes = settings.MAX_FILE_SIZE_KB * 1024

                for abs_p in candidate_files:
                    parsed_info, skip_reason = CodebaseParser.parse_file(repo_dir, abs_p, max_bytes)
                    if parsed_info:
                        parsed_files.append(parsed_info)
                        total_lines += parsed_info.line_count
                    elif skip_reason:
                        rel_p = os.path.relpath(abs_p, repo_dir)
                        skipped_files.append({"path": rel_p, "reason": skip_reason})

                repo.total_files = len(parsed_files)
                repo.total_lines = total_lines
                repo.skipped_files = skipped_files[:100]

                # Save FileItems to DB
                for pf in parsed_files:
                    f_item = FileItem(
                        repository_id=repo.id,
                        path=pf.rel_path,
                        name=pf.name,
                        extension=pf.extension,
                        language=pf.language,
                        size_bytes=pf.size_bytes,
                        line_count=pf.line_count,
                        is_binary=pf.is_binary,
                        sha256_hash=pf.sha256_hash,
                        imports=pf.imports[:30],
                        exports=pf.exports[:30],
                        functions_count=len(pf.functions),
                        classes_count=len(pf.classes)
                    )
                    db.add(f_item)

                # STEP 9: Generate semantic chunks
                repo.status = "INDEXING"
                repo.status_message = "Generating semantic code chunks..."
                repo.progress = 65
                await db.commit()

                all_chunks: List[Chunk] = []
                for pf in parsed_files:
                    file_chunks = SemanticChunker.chunk_file(pf)
                    all_chunks.extend(file_chunks)

                repo.total_chunks = len(all_chunks)

                # STEP 10-11: Create embeddings & store searchable vectors
                repo.status_message = f"Embedding {len(all_chunks)} semantic chunks for vector search..."
                repo.progress = 75
                await db.commit()

                # Process chunk embeddings in batches
                batch_size = 50
                for i in range(0, len(all_chunks), batch_size):
                    batch = all_chunks[i : i + batch_size]
                    texts = [c.content for c in batch]
                    embeddings = await embedding_engine.get_embeddings_batch(texts)

                    for chunk_obj, emb in zip(batch, embeddings):
                        db_chunk = CodeChunk(
                            repository_id=repo.id,
                            file_path=chunk_obj.file_path,
                            language=chunk_obj.language,
                            chunk_type=chunk_obj.chunk_type,
                            name=chunk_obj.name,
                            start_line=chunk_obj.start_line,
                            end_line=chunk_obj.end_line,
                            content=chunk_obj.content,
                            content_hash=chunk_obj.content_hash,
                            embedding=emb
                        )
                        db.add(db_chunk)

                # STEP 12: Generate Architecture Graph & Summaries
                repo.status_message = "Constructing dependency graph & architectural visualizer..."
                repo.progress = 85
                await db.commit()

                arch_data = ArchitectureService.build_architecture_graph(parsed_files, repo.name)
                repo.architecture_summary = arch_data["summary"]

                arch_graph = ArchitectureGraph(
                    repository_id=repo.id,
                    graph_data=arch_data
                )
                db.add(arch_graph)

                # STEP 13: Security scanning & Documentation generation
                repo.status_message = "Running security vulnerability scan & generating technical docs..."
                repo.progress = 92
                await db.commit()

                # Security scan
                sec_report = await SecurityScanner.scan_repository(repo_dir, parsed_files)
                for fd in sec_report["findings"]:
                    finding = SecurityFinding(
                        repository_id=repo.id,
                        rule_id=fd["rule_id"],
                        title=fd["title"],
                        severity=fd["severity"],
                        category=fd["category"],
                        file_path=fd["file_path"],
                        line_number=fd["line_number"],
                        code_snippet=fd.get("code_snippet"),
                        description=fd["description"],
                        suggested_remediation=fd.get("suggested_remediation"),
                        is_confirmed=fd.get("is_confirmed", True)
                    )
                    db.add(finding)

                # Documentation generation
                docs = DocumentationGenerator.generate_all_docs(repo, parsed_files)
                for d in docs:
                    doc_item = DocumentationItem(
                        repository_id=repo.id,
                        doc_type=d["doc_type"],
                        title=d["title"],
                        content=d["content"]
                    )
                    db.add(doc_item)

                # STEP 14: Finalize and make available for AI queries
                repo.status = "COMPLETED"
                repo.status_message = "Analysis complete. Repository knowledge index ready for AI queries."
                repo.progress = 100
                await db.commit()

            except Exception as e:
                repo.status = "FAILED"
                repo.status_message = f"Analysis failed: {str(e)}"
                repo.progress = 0
                await db.commit()
                print(f"[Pipeline Error] {e}")
            finally:
                # Secure clean up of local checkout files after indexing is complete
                # This protects privacy and conserves local disk space
                if os.path.exists(repo_dir):
                    shutil.rmtree(repo_dir, ignore_errors=True)
