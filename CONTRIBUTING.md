# Contributing to RepoMind AI

First off, thank you for considering contributing to **RepoMind AI**! Developers like you make open source incredible.

## 🚀 Quick Start for Contributors

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/<your-username>/repomind-ai.git
   cd repomind-ai
   ```
3. **Create a topic branch**:
   ```bash
   git checkout -b feat/your-feature-name
   ```
4. **Set up the local environment**:
   - Python virtualenv:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     pip install -r backend/requirements.txt
     ```
   - Node.js frontend:
     ```bash
     cd frontend
     npm install
     ```

## 🧪 Testing Guidelines

Before opening a pull request, ensure all tests pass:

```bash
# Backend pytest suite
PYTHONPATH=backend pytest backend/tests -v

# Frontend type check & build
cd frontend && npm run build
```

## 📝 Commit Convention

We follow standard Conventional Commits:
- `feat: add AST support for Kotlin`
- `fix: handle empty commits in shallow clone`
- `docs: update deployment guidelines`
- `test: add RAG citation integration test`

## 📬 Submitting a Pull Request

1. Push your branch to GitHub.
2. Open a Pull Request targeting the `main` branch.
3. Fill out the pull request template with details on your changes and test coverage.
4. A maintainer will review your pull request promptly!
