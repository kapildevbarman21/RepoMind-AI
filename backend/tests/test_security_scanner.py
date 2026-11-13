import pytest
from app.services.security_scanner import SecurityScanner
from app.services.parser.tree_sitter_parser import ParsedFileInfo

@pytest.mark.asyncio
async def test_security_scanner_detects_secrets():
    content = """
# Insecure config file
AWS_KEY = "AKIA1111222233334444"
DB_URL = "postgres://admin:supersecretpassword@db.prod.internal:5432/core"

def run_command(user_input):
    eval(user_input)
    os.system(user_input)
"""
    file_info = ParsedFileInfo(
        rel_path="src/config.py",
        name="config.py",
        extension=".py",
        language="python",
        size_bytes=len(content),
        line_count=len(content.splitlines()),
        sha256_hash="dummyhash",
        raw_content=content
    )

    report = await SecurityScanner.scan_repository("/tmp", [file_info])
    assert report["total_findings"] >= 3
    rule_ids = [f["rule_id"] for f in report["findings"]]
    assert "SEC-001" in rule_ids # AWS key
    assert "SEC-004" in rule_ids # DB URL
    assert any(rid in ("SEC-006", "SEC-007") for rid in rule_ids) # eval/exec/system
