"""Vision tool: llava (or any multimodal model) as an on-demand oracle.

llama3.1:8b is text-only, so it cannot see screenshots directly. This tool
hands the image off to a vision model and returns a text description that
fits cleanly back into the normal tool-message flow.

`see_screen` either captures the screen or reads an existing image path,
sends it to the vision model via Ollama, and returns the model's answer.
"""

from __future__ import annotations

import base64
import io
import os
import tempfile


DEFAULT_VISION_MODEL = os.environ.get("LLAMAOS_VISION_MODEL", "llava:7b")
DEFAULT_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")


def _capture(region: list[int] | None):
    import pyautogui
    pyautogui.FAILSAFE = True
    if region and len(region) == 4:
        return pyautogui.screenshot(region=tuple(region))
    return pyautogui.screenshot()


def _load(path: str):
    from PIL import Image
    return Image.open(path)


def _ask_vision(img, query: str, model: str, host: str) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()

    import ollama
    client = ollama.Client(host=host)
    resp = client.chat(
        model=model,
        messages=[{"role": "user", "content": query, "images": [b64]}],
        options={"temperature": 0.1},
    )
    msg = resp["message"] if isinstance(resp, dict) else resp.message
    return (msg.get("content") if isinstance(msg, dict) else msg.content) or ""


def see_screen(
    query: str = "Describe what's on the screen. Identify visible apps, windows, and key UI elements with their approximate pixel coordinates.",
    region: list[int] | None = None,
    path: str | None = None,
    model: str | None = None,
    host: str | None = None,
) -> dict:
    """Capture (or load) an image and have a vision model describe it."""
    vision_model = model or DEFAULT_VISION_MODEL
    vision_host = host or DEFAULT_HOST

    try:
        if path:
            img = _load(path)
            source = path
        else:
            img = _capture(region)
            fd, source = tempfile.mkstemp(suffix=".png", prefix="llamaos_")
            os.close(fd)
            img.save(source)
    except Exception as e:
        return {"error": f"capture failed: {type(e).__name__}: {e}"}

    try:
        description = _ask_vision(img, query, vision_model, vision_host)
    except Exception as e:
        return {
            "path": source,
            "width": img.width,
            "height": img.height,
            "error": f"vision model failed: {type(e).__name__}: {e}",
        }

    return {
        "path": source,
        "width": img.width,
        "height": img.height,
        "model": vision_model,
        "description": description,
    }


SCHEMA = {
    "type": "function",
    "function": {
        "name": "see_screen",
        "description": (
            "Look at the screen (or an existing image file) using a vision model "
            "and get back a text description. Use this when you need to know what's "
            "visible — UI elements, window contents, error dialogs, etc. — before "
            "deciding where to click or type."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query":  {"type": "string", "description": "What to ask the vision model about the image"},
                "region": {"type": "array", "items": {"type": "integer"}, "description": "[x, y, w, h] to capture (optional)"},
                "path":   {"type": "string", "description": "Path to existing image instead of capturing"},
                "model":  {"type": "string", "description": "Vision model tag (default: llava:7b)"},
            },
        },
    },
}


def call(args: dict) -> dict:
    return see_screen(**args)
