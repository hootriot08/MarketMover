"""Bash command execution."""

from __future__ import annotations

import subprocess
from dataclasses import dataclass


@dataclass
class ShellResult:
    stdout: str
    stderr: str
    exit_code: int
    timed_out: bool


def _trim(s: str | bytes | None, n: int) -> str:
    if s is None:
        return ""
    if isinstance(s, bytes):
        s = s.decode("utf-8", "replace")
    return s[-n:]


def run(command: str, timeout: int = 30, cwd: str | None = None) -> ShellResult:
    try:
        r = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=cwd,
        )
        return ShellResult(
            stdout=_trim(r.stdout, 4000),
            stderr=_trim(r.stderr, 2000),
            exit_code=r.returncode,
            timed_out=False,
        )
    except subprocess.TimeoutExpired as e:
        return ShellResult(
            stdout=_trim(e.stdout, 4000),
            stderr=_trim(e.stderr, 2000),
            exit_code=-1,
            timed_out=True,
        )


SCHEMA = {
    "type": "function",
    "function": {
        "name": "shell",
        "description": (
            "Execute a bash command on the host. Returns stdout, stderr, exit code. "
            "Use for system actions not covered by more specific tools."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "Bash command to run"},
                "timeout": {"type": "integer", "description": "Seconds before kill", "default": 30},
                "cwd":     {"type": "string", "description": "Working directory (optional)"},
            },
            "required": ["command"],
        },
    },
}


def call(args: dict) -> dict:
    res = run(
        command=args["command"],
        timeout=int(args.get("timeout", 30)),
        cwd=args.get("cwd"),
    )
    return {
        "stdout": res.stdout,
        "stderr": res.stderr,
        "exit_code": res.exit_code,
        "timed_out": res.timed_out,
    }
