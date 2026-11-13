# Changelog

All notable changes to **RepoMind AI** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-14

### Added
- **Core Platform:** Complete full-stack release with Next.js 15, FastAPI, and PostgreSQL with pgvector.
- **Tree-sitter AST Engine:** High-performance parsers for Python, TypeScript, JavaScript, Go, Rust, Java, C, C++, and robust fallbacks.
- **Semantic Code Chunker:** Function, class, and block-level sliding window chunker with SHA256 content deduplication.
- **Fact-Grounded Vector Chat:** Conversational RAG with exact line number citations (`[file.py:15-35]`) and follow-up prompts.
- **React Flow Architecture Explorer:** Interactive directed graph with tier clustering (Entrypoints, Routes, Services, Models, UI, Utilities) and component metrics.
- **Static Security Scanner:** Detects exposed cloud keys, database URLs, eval/exec, SQL injection patterns, and Bandit audit integration.
- **Automated Technical Documentation:** Auto-generates README, Architecture Guide, API Reference, Developer Onboarding, and Contributing Guides.
- **Monaco Code Viewer:** Integrated VS Code-grade Monaco Editor with syntax highlighting and file tree navigation.
- **Docker & Compose:** Production-ready containerized deployment with healthchecks and volume persistence.
