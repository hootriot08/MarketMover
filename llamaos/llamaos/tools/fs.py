"""Filesystem tools."""

from __future__ import annotations

from pathlib import Path

MAX_READ = 200_000


def read_file(path: str, max_bytes: int = MAX_READ) -> dict:
    p = Path(path).expanduser()
    if not p.exists():
        return {"error": f"not found: {path}"}
    if p.is_dir():
        return {"error": f"is a directory: {path}"}
    data = p.read_bytes()[:max_bytes]
    try:
        text = data.decode("utf-8")
        return {"path": str(p), "size": p.stat().st_size, "content": text}
    except UnicodeDecodeError:
        return {"path": str(p), "size": p.stat().st_size, "content": f"<binary, {len(data)} bytes>"}


def write_file(path: str, content: str, append: bool = False) -> dict:
    p = Path(path).expanduser()
    p.parent.mkdir(parents=True, exist_ok=True)
    mode = "a" if append else "w"
    with open(p, mode, encoding="utf-8") as f:
        f.write(content)
    return {"path": str(p), "bytes_written": len(content), "mode": mode}


def list_dir(path: str = ".") -> dict:
    p = Path(path).expanduser()
    if not p.exists():
        return {"error": f"not found: {path}"}
    if not p.is_dir():
        return {"error": f"not a directory: {path}"}
    entries = []
    for item in sorted(p.iterdir()):
        try:
            stat = item.stat()
            entries.append({
                "name": item.name,
                "type": "dir" if item.is_dir() else "file",
                "size": stat.st_size,
            })
        except OSError:
            continue
    return {"path": str(p), "count": len(entries), "entries": entries}


READ_SCHEMA = {
    "type": "function",
    "function": {
        "name": "read_file",
        "description": "Read a file from disk (UTF-8, truncated at 200 KB).",
        "parameters": {
            "type": "object",
            "properties": {"path": {"type": "string"}},
            "required": ["path"],
        },
    },
}

WRITE_SCHEMA = {
    "type": "function",
    "function": {
        "name": "write_file",
        "description": "Write or append to a file. Creates parent directories.",
        "parameters": {
            "type": "object",
            "properties": {
                "path":    {"type": "string"},
                "content": {"type": "string"},
                "append":  {"type": "boolean", "default": False},
            },
            "required": ["path", "content"],
        },
    },
}

LIST_SCHEMA = {
    "type": "function",
    "function": {
        "name": "list_dir",
        "description": "List the contents of a directory.",
        "parameters": {
            "type": "object",
            "properties": {"path": {"type": "string", "default": "."}},
        },
    },
}
