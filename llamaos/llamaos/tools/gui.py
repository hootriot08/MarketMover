"""GUI control: screen capture + mouse + keyboard."""

from __future__ import annotations

import os
import tempfile


def _pyautogui():
    import pyautogui  # imported lazily — needs a display
    pyautogui.FAILSAFE = True
    return pyautogui


def screenshot(region: list[int] | None = None) -> dict:
    try:
        pg = _pyautogui()
    except Exception as e:
        return {"error": f"GUI unavailable: {type(e).__name__}: {e}"}
    if region and len(region) == 4:
        img = pg.screenshot(region=tuple(region))
    else:
        img = pg.screenshot()
    fd, path = tempfile.mkstemp(suffix=".png", prefix="llamaos_")
    os.close(fd)
    img.save(path)
    return {"path": path, "width": img.width, "height": img.height}


def click(x: int, y: int, button: str = "left", clicks: int = 1) -> dict:
    pg = _pyautogui()
    pg.click(x=x, y=y, button=button, clicks=clicks)
    return {"clicked_at": [x, y], "button": button, "clicks": clicks}


def move(x: int, y: int, duration: float = 0.1) -> dict:
    pg = _pyautogui()
    pg.moveTo(x, y, duration=duration)
    return {"moved_to": [x, y]}


def type_text(text: str, interval: float = 0.02) -> dict:
    pg = _pyautogui()
    pg.typewrite(text, interval=interval)
    return {"length": len(text)}


def hotkey(keys: list[str]) -> dict:
    pg = _pyautogui()
    pg.hotkey(*keys)
    return {"pressed": keys}


def mouse_position() -> dict:
    pg = _pyautogui()
    x, y = pg.position()
    return {"x": int(x), "y": int(y)}


SCREENSHOT_SCHEMA = {
    "type": "function",
    "function": {
        "name": "screenshot",
        "description": "Capture the screen (or a region) and save it as PNG. Returns the file path.",
        "parameters": {
            "type": "object",
            "properties": {
                "region": {
                    "type": "array",
                    "items": {"type": "integer"},
                    "description": "[x, y, width, height] — optional, full screen if omitted",
                },
            },
        },
    },
}

CLICK_SCHEMA = {
    "type": "function",
    "function": {
        "name": "click",
        "description": "Click the mouse at (x, y) in screen pixels.",
        "parameters": {
            "type": "object",
            "properties": {
                "x":      {"type": "integer"},
                "y":      {"type": "integer"},
                "button": {"type": "string", "enum": ["left", "right", "middle"], "default": "left"},
                "clicks": {"type": "integer", "default": 1},
            },
            "required": ["x", "y"],
        },
    },
}

MOVE_SCHEMA = {
    "type": "function",
    "function": {
        "name": "move_mouse",
        "description": "Move the mouse to (x, y).",
        "parameters": {
            "type": "object",
            "properties": {
                "x": {"type": "integer"},
                "y": {"type": "integer"},
            },
            "required": ["x", "y"],
        },
    },
}

TYPE_SCHEMA = {
    "type": "function",
    "function": {
        "name": "type_text",
        "description": "Type text through the keyboard at the current focus.",
        "parameters": {
            "type": "object",
            "properties": {"text": {"type": "string"}},
            "required": ["text"],
        },
    },
}

HOTKEY_SCHEMA = {
    "type": "function",
    "function": {
        "name": "hotkey",
        "description": "Press a key combination, e.g. ['ctrl', 'c'] or ['cmd', 'space'].",
        "parameters": {
            "type": "object",
            "properties": {
                "keys": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["keys"],
        },
    },
}

POS_SCHEMA = {
    "type": "function",
    "function": {
        "name": "mouse_position",
        "description": "Get the current mouse cursor position.",
        "parameters": {"type": "object", "properties": {}},
    },
}
