"""Tool registry: name -> (schema, callable)."""

from __future__ import annotations

from typing import Any, Callable

from . import fs, gui, shell, system, vision

ToolFn = Callable[[dict], Any]

REGISTRY: dict[str, tuple[dict, ToolFn]] = {
    "shell":          (shell.SCHEMA,          shell.call),
    "read_file":      (fs.READ_SCHEMA,        lambda a: fs.read_file(**a)),
    "write_file":     (fs.WRITE_SCHEMA,       lambda a: fs.write_file(**a)),
    "list_dir":       (fs.LIST_SCHEMA,        lambda a: fs.list_dir(**a)),
    "system_info":    (system.SYS_SCHEMA,     lambda a: system.system_info()),
    "processes":      (system.PROC_SCHEMA,    lambda a: system.processes(**a)),
    "network":        (system.NET_SCHEMA,     lambda a: system.network()),
    "screenshot":     (gui.SCREENSHOT_SCHEMA, lambda a: gui.screenshot(**a)),
    "see_screen":     (vision.SCHEMA,         vision.call),
    "click":          (gui.CLICK_SCHEMA,      lambda a: gui.click(**a)),
    "move_mouse":     (gui.MOVE_SCHEMA,       lambda a: gui.move(**a)),
    "type_text":      (gui.TYPE_SCHEMA,       lambda a: gui.type_text(**a)),
    "hotkey":         (gui.HOTKEY_SCHEMA,     lambda a: gui.hotkey(**a)),
    "mouse_position": (gui.POS_SCHEMA,        lambda a: gui.mouse_position()),
}


def schemas() -> list[dict]:
    return [s for s, _ in REGISTRY.values()]


def call(name: str, args: dict) -> Any:
    if name not in REGISTRY:
        return {"error": f"unknown tool: {name}"}
    _, fn = REGISTRY[name]
    try:
        return fn(args or {})
    except Exception as e:
        return {"error": f"{type(e).__name__}: {e}"}
