import os
import re
import shutil
import asyncio
import httpx
from typing import Dict, Any, Tuple, Optional
from urllib.parse import urlparse
import ipaddress
from app.core.config import settings

# Denylist for SSRF protection
BLOCKED_IP_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]

def parse_github_url(url: str) -> Tuple[str, str]:
    """Extract owner and repo name from GitHub URL or 'owner/repo' shorthand."""
    url = url.strip()
    if re.match(r"^[a-zA-Z0-9_\-\.]+/[a-zA-Z0-9_\-\.]+$", url):
        parts = url.split("/")
        return parts[0], parts[1].replace(".git", "")
    
    parsed = urlparse(url)
    if parsed.netloc not in ("github.com", "www.github.com"):
        raise ValueError("Invalid host. Only github.com repositories are supported.")
    
    parts = parsed.path.strip("/").split("/")
    if len(parts) < 2:
        raise ValueError("Invalid repository URL format. Expected: github.com/owner/repo")
    
    owner = parts[0]
    repo = parts[1].replace(".git", "")
    return owner, repo

def is_safe_url(url: str) -> bool:
    """Validate that URL doesn't point to local or private IP addresses."""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        hostname = parsed.hostname
        if not hostname or hostname in ("localhost", "127.0.0.1", "::1"):
            return False
        # Try resolving IP if numeric
        try:
            ip = ipaddress.ip_address(hostname)
            for network in BLOCKED_IP_NETWORKS:
                if ip in network:
                    return False
        except ValueError:
            pass # Domain name, github.com is safe
        return parsed.netloc in ("github.com", "www.github.com", "api.github.com")
    except Exception:
        return False

class GitHubService:
    @staticmethod
    async def fetch_repository_metadata(owner: str, repo: str, auth_token: Optional[str] = None) -> Dict[str, Any]:
        """Fetch metadata for public or private repository using GitHub API."""
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "RepoMind-AI-Engine"
        }
        token = auth_token or settings.GITHUB_TOKEN
        if token:
            headers["Authorization"] = f"Bearer {token}"
            
        api_url = f"https://api.github.com/repos/{owner}/{repo}"
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(api_url, headers=headers)
            
            if resp.status_code == 404:
                raise ValueError(f"Repository '{owner}/{repo}' not found on GitHub. If private, please provide an authorized token.")
            elif resp.status_code == 403 and "rate limit exceeded" in resp.text.lower():
                raise ValueError("GitHub API rate limit exceeded. Please provide a GitHub Personal Access Token in settings.")
            elif resp.status_code != 200:
                raise ValueError(f"Failed to fetch GitHub repository details: {resp.status_code} - {resp.text}")
            
            repo_data = resp.json()
            
            # Fetch languages breakdown
            languages = {}
            try:
                lang_resp = await client.get(repo_data.get("languages_url", f"{api_url}/languages"), headers=headers)
                if lang_resp.status_code == 200:
                    raw_langs = lang_resp.json()
                    total_bytes = sum(raw_langs.values()) or 1
                    languages = {k: round((v / total_bytes) * 100, 1) for k, v in raw_langs.items()}
            except Exception:
                pass
            
            return {
                "name": repo_data.get("name"),
                "owner": owner,
                "full_name": repo_data.get("full_name", f"{owner}/{repo}"),
                "url": repo_data.get("html_url", f"https://github.com/{owner}/{repo}"),
                "description": repo_data.get("description"),
                "default_branch": repo_data.get("default_branch", "main"),
                "stars": repo_data.get("stargazers_count", 0),
                "forks": repo_data.get("forks_count", 0),
                "watchers": repo_data.get("watchers_count", 0),
                "open_issues": repo_data.get("open_issues_count", 0),
                "size_kb": repo_data.get("size", 0),
                "primary_language": repo_data.get("language"),
                "languages": languages,
            }

    @staticmethod
    async def clone_repository(
        owner: str,
        repo: str,
        target_dir: str,
        branch: Optional[str] = None,
        commit: Optional[str] = None,
        auth_token: Optional[str] = None
    ) -> str:
        """
        Securely shallow clones a repository into a sandboxed target directory.
        Limits depth to 1 and enforces timeout to avoid hanging on massive repositories.
        """
        if os.path.exists(target_dir):
            shutil.rmtree(target_dir, ignore_errors=True)
        os.makedirs(target_dir, exist_ok=True)
        
        token = auth_token or settings.GITHUB_TOKEN
        if token:
            clone_url = f"https://x-access-token:{token}@github.com/{owner}/{repo}.git"
        else:
            clone_url = f"https://github.com/{owner}/{repo}.git"
        
        cmd = ["git", "clone", "--depth", "1"]
        if branch:
            cmd.extend(["-b", branch])
        cmd.extend([clone_url, target_dir])
        
        # Execute shallow clone with timeout
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=settings.ANALYSIS_TIMEOUT_SECONDS)
        except asyncio.TimeoutError:
            proc.kill()
            shutil.rmtree(target_dir, ignore_errors=True)
            raise TimeoutError(f"Cloning repository exceeded timeout of {settings.ANALYSIS_TIMEOUT_SECONDS}s")
            
        if proc.returncode != 0:
            err_msg = stderr.decode().replace(token, "[REDACTED]") if token else stderr.decode()
            shutil.rmtree(target_dir, ignore_errors=True)
            raise RuntimeError(f"Git clone failed: {err_msg.strip()}")
            
        # If specific commit requested, checkout
        if commit:
            commit_proc = await asyncio.create_subprocess_exec(
                "git", "checkout", commit,
                cwd=target_dir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await commit_proc.communicate()
            
        # Get current HEAD commit sha
        rev_proc = await asyncio.create_subprocess_exec(
            "git", "rev-parse", "HEAD",
            cwd=target_dir,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        sha_out, _ = await rev_proc.communicate()
        head_sha = sha_out.decode().strip()
        
        # Remove .git metadata directory to save space and avoid git state issues
        git_dir = os.path.join(target_dir, ".git")
        if os.path.exists(git_dir):
            shutil.rmtree(git_dir, ignore_errors=True)
            
        return head_sha
