"""Confirmation gate for destructive or visible-side-effect tools."""

from __future__ import annotations

import json

DANGEROUS = {
    "shell",
    "write_file",
    "click",
    "move_mouse",
    "type_text",
    "hotkey",
}


def needs_confirmation(tool: str, args: dict, yolo: bool) -> bool:
    if yolo:
        return False
    return tool in DANGEROUS


def confirm(tool: str, args: dict) -> bool:
    preview = json.dumps(args, default=str)
    if len(preview) > 400:
        preview = preview[:400] + "..."
    print(f"\n\x1b[33m[confirm] {tool}({preview})\x1b[0m")
    try:
        ans = input("execute? [y/N] ").strip().lower()
    except EOFError:
        return False
    return ans in ("y", "yes")
