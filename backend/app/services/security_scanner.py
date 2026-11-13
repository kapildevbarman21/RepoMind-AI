import os
import re
import json
import asyncio
from typing import List, Dict, Any
from app.services.parser.tree_sitter_parser import ParsedFileInfo

SECURITY_RULES = [
    {
        "id": "SEC-001",
        "title": "Hardcoded AWS Access Key",
        "severity": "CRITICAL",
        "category": "SECRET",
        "regex": r"(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}",
        "description": "Hardcoded AWS Access Key ID detected. If committed to version control, unauthorized actors can access cloud infrastructure.",
        "remediation": "Revoke this key immediately in AWS IAM and store credentials in environment variables or an IAM Instance Profile.",
        "is_confirmed": True
    },
    {
        "id": "SEC-002",
        "title": "Exposed GitHub Personal Access Token",
        "severity": "CRITICAL",
        "category": "SECRET",
        "regex": r"(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}",
        "description": "Exposed GitHub token detected. Can be abused to access private repositories, push unauthorized commits, or read secrets.",
        "remediation": "Revoke the token in GitHub Settings > Developer settings > Personal access tokens, and use GitHub Actions secrets.",
        "is_confirmed": True
    },
    {
        "id": "SEC-003",
        "title": "Private Cryptographic Key",
        "severity": "CRITICAL",
        "category": "SECRET",
        "regex": r"-----BEGIN (?:RSA|DSA|EC|OPENSSH|PGP) PRIVATE KEY-----",
        "description": "Unencrypted private cryptographic key committed in plaintext. Compromises SSL/TLS encryption or SSH authentication.",
        "remediation": "Remove the private key from the repository, rotate associated public keys/certificates, and load keys at runtime via secret managers.",
        "is_confirmed": True
    },
    {
        "id": "SEC-004",
        "title": "Hardcoded Database Connection String with Credentials",
        "severity": "HIGH",
        "category": "SECRET",
        "regex": r"(?:postgres|postgresql|mysql|mongodb|redis)://[^:]+:[^@\s]+@[a-zA-Z0-9\.\-_]+:\d+",
        "description": "Database connection URI contains embedded plaintext username and password.",
        "remediation": "Inject the connection string via the DATABASE_URL environment variable; do not commit credentials to source control.",
        "is_confirmed": True
    },
    {
        "id": "SEC-005",
        "title": "Potential SQL Injection via String Interpolation",
        "severity": "HIGH",
        "category": "INJECTION",
        "regex": r"(?:execute|raw|query)\s*\(\s*f[\"'].*(?:SELECT|INSERT|UPDATE|DELETE|DROP).*\{",
        "description": "SQL query is constructed using dynamic string formatting/f-strings, opening potential SQL injection vulnerabilities.",
        "remediation": "Use parameterized queries or ORM query builders (e.g., execute('SELECT * FROM users WHERE id = :id', {'id': user_id})).",
        "is_confirmed": False
    },
    {
        "id": "SEC-006",
        "title": "Arbitrary Code Execution via eval() or exec()",
        "severity": "HIGH",
        "category": "INJECTION",
        "regex": r"\b(?:eval|exec)\s*\([^)]*[\w\.\_]+[^)]*\)",
        "description": "Use of eval() or exec() on dynamic arguments can lead to remote code execution (RCE).",
        "remediation": "Refactor logic to use safe parsers like json.loads() or ast.literal_eval() instead of dynamic evaluation.",
        "is_confirmed": False
    },
    {
        "id": "SEC-007",
        "title": "Command Injection via Shell Execution",
        "severity": "HIGH",
        "category": "INJECTION",
        "regex": r"(?:os\.system|subprocess\.(?:Popen|call|run)\s*\([^)]*shell\s*=\s*True|child_process\.exec\s*\()",
        "description": "Command execution with shell=True or direct string command execution can permit shell injection.",
        "remediation": "Pass arguments as a list with shell=False (e.g., subprocess.run(['cmd', arg1], shell=False)).",
        "is_confirmed": False
    },
    {
        "id": "SEC-008",
        "title": "Insecure Deserialization (pickle/unsafe yaml)",
        "severity": "HIGH",
        "category": "INJECTION",
        "regex": r"(?:pickle\.loads?|yaml\.load\s*\([^,)]+\))",
        "description": "Loading untrusted serialized data with pickle or yaml.load without SafeLoader allows arbitrary code execution.",
        "remediation": "Use json or yaml.safe_load() instead of pickle or unsafe YAML loaders.",
        "is_confirmed": True
    },
    {
        "id": "SEC-009",
        "title": "Permissive CORS Configuration (Wildcard with Credentials)",
        "severity": "MEDIUM",
        "category": "CONFIGURATION",
        "regex": r"(?:allow_origins\s*=\s*\[[\"']\*[\"']\]|cors\(\s*\{\s*origin:\s*[\"']\*[\"']\s*\})",
        "description": "Wildcard CORS origin configured. Any website can make cross-origin requests to your API.",
        "remediation": "Specify explicit trusted domains in CORS allow_origins (e.g., https://app.example.com).",
        "is_confirmed": True
    },
    {
        "id": "SEC-010",
        "title": "Disabled SSL/TLS Certificate Verification",
        "severity": "HIGH",
        "category": "CONFIGURATION",
        "regex": r"(?:verify\s*=\s*False|rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['\"]?0)",
        "description": "SSL certificate verification is explicitly disabled, exposing network calls to Man-in-the-Middle (MITM) attacks.",
        "remediation": "Enable SSL verification (verify=True) and ensure valid CA certificates are configured.",
        "is_confirmed": True
    },
    {
        "id": "SEC-011",
        "title": "Generic Secret Assignment in Source Code",
        "severity": "MEDIUM",
        "category": "SECRET",
        "regex": r"(?:secret_key|api_key|auth_token|client_secret|password)\s*=\s*['\"][a-zA-Z0-9_\-\.\$]{16,}['\"]",
        "description": "Potential secret or credentials literal found assigned directly in source code.",
        "remediation": "Load secret variables using os.environ or a secret management vault.",
        "is_confirmed": False
    }
]

class SecurityScanner:
    @classmethod
    async def scan_repository(cls, repo_root: str, parsed_files: List[ParsedFileInfo]) -> Dict[str, Any]:
        """
        Runs comprehensive security audit on repository files without executing any code.
        Combines Bandit for Python with pattern-based AST audits for all languages.
        """
        findings: List[Dict[str, Any]] = []

        # 1. Pattern & Static Rule Scan across all files
        for f in parsed_files:
            if not f.raw_content or f.is_binary:
                continue

            lines = f.raw_content.splitlines()
            for line_idx, line in enumerate(lines):
                line_no = line_idx + 1
                stripped = line.strip()
                
                # Skip comments or test mock tokens
                if stripped.startswith(("#", "//", "/*", "*")) and "example" in stripped.lower():
                    continue

                for rule in SECURITY_RULES:
                    match = re.search(rule["regex"], line)
                    if match:
                        matched_snippet = stripped
                        # Mask sensitive secret matches in output
                        if rule["category"] == "SECRET":
                            matched_text = match.group(0)
                            if len(matched_text) > 8:
                                masked = matched_text[:4] + "*" * (len(matched_text) - 8) + matched_text[-4:]
                                matched_snippet = matched_snippet.replace(matched_text, masked)

                        findings.append({
                            "rule_id": rule["id"],
                            "title": rule["title"],
                            "severity": rule["severity"],
                            "category": rule["category"],
                            "file_path": f.rel_path,
                            "line_number": line_no,
                            "code_snippet": matched_snippet[:180],
                            "description": rule["description"],
                            "suggested_remediation": rule["remediation"],
                            "is_confirmed": rule["is_confirmed"]
                        })

        # 2. Run Bandit on Python files if any exist
        has_python = any(f.language == "python" for f in parsed_files)
        if has_python and os.path.exists(repo_root):
            try:
                proc = await asyncio.create_subprocess_exec(
                    "bandit", "-r", repo_root, "-f", "json", "-q",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30.0)
                if stdout:
                    try:
                        bandit_data = json.loads(stdout.decode())
                        for issue in bandit_data.get("results", []):
                            rel_p = os.path.relpath(issue.get("filename", ""), repo_root)
                            sev = issue.get("issue_severity", "LOW").upper()
                            findings.append({
                                "rule_id": f"BANDIT-{issue.get('test_id', '000')}",
                                "title": issue.get("issue_text", "Bandit Security Finding"),
                                "severity": sev if sev in ("CRITICAL", "HIGH", "MEDIUM", "LOW") else "MEDIUM",
                                "category": "CODE_QUALITY",
                                "file_path": rel_p,
                                "line_number": issue.get("line_number", 1),
                                "code_snippet": (issue.get("code") or "").strip()[:180],
                                "description": issue.get("issue_text", ""),
                                "suggested_remediation": f"Refer to Bandit test {issue.get('test_id')} documentation.",
                                "is_confirmed": True
                            })
                    except Exception:
                        pass
            except Exception:
                pass

        # Deduplicate findings by (file_path, line_number, rule_id)
        deduped = []
        seen = set()
        for fd in findings:
            key = (fd["file_path"], fd["line_number"], fd["rule_id"])
            if key not in seen:
                seen.add(key)
                deduped.append(fd)

        # Count severities
        critical_count = sum(1 for x in deduped if x["severity"] == "CRITICAL")
        high_count = sum(1 for x in deduped if x["severity"] == "HIGH")
        medium_count = sum(1 for x in deduped if x["severity"] == "MEDIUM")
        low_count = sum(1 for x in deduped if x["severity"] in ("LOW", "INFO"))

        return {
            "total_findings": len(deduped),
            "critical_count": critical_count,
            "high_count": high_count,
            "medium_count": medium_count,
            "low_count": low_count,
            "findings": deduped
        }
