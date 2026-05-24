"""Diagnose a llamaos installation — prove the real Ollama works.

Run: python -m llamaos --doctor
"""

from __future__ import annotations

import importlib
import os
import platform
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass

GREEN = "\x1b[32m"
RED = "\x1b[31m"
YELLOW = "\x1b[33m"
GREY = "\x1b[90m"
RESET = "\x1b[0m"

OK = f"{GREEN}OK{RESET}"
FAIL = f"{RED}FAIL{RESET}"
WARN = f"{YELLOW}WARN{RESET}"


@dataclass
class Check:
    name: str
    status: str
    detail: str = ""
    fix: str = ""


def _has_cmd(name: str) -> bool:
    return shutil.which(name) is not None


def check_python() -> Check:
    v = sys.version_info
    if v >= (3, 10):
        return Check("python >= 3.10", OK, f"Python {v.major}.{v.minor}.{v.micro}")
    return Check("python >= 3.10", FAIL, f"Python {v.major}.{v.minor}", "install python 3.10+")


def check_pkg(name: str, import_name: str | None = None) -> Check:
    mod = import_name or name
    try:
        m = importlib.import_module(mod)
        ver = getattr(m, "__version__", "?")
        return Check(f"python pkg: {name}", OK, f"{name} {ver}")
    except ImportError:
        return Check(f"python pkg: {name}", FAIL, "not installed",
                     f"pip install {name}")


def check_ollama_cli() -> Check:
    if not _has_cmd("ollama"):
        return Check("ollama CLI", FAIL, "not on PATH",
                     "https://ollama.ai/download")
    try:
        v = subprocess.run(["ollama", "--version"], capture_output=True, text=True, timeout=5)
        return Check("ollama CLI", OK, v.stdout.strip() or v.stderr.strip())
    except Exception as e:
        return Check("ollama CLI", WARN, f"present but errored: {e}")


def check_ollama_daemon(host: str) -> Check:
    try:
        import urllib.request
        with urllib.request.urlopen(f"{host}/api/version", timeout=3) as r:
            body = r.read().decode()
        return Check(f"ollama daemon @ {host}", OK, body.strip())
    except Exception as e:
        return Check(f"ollama daemon @ {host}", FAIL, str(e),
                     "run: ollama serve")


def check_model(host: str, tag: str) -> Check:
    try:
        import json
        import urllib.request
        with urllib.request.urlopen(f"{host}/api/tags", timeout=5) as r:
            data = json.loads(r.read().decode())
        names = [m.get("name", "") for m in data.get("models", [])]
        for n in names:
            if n == tag or n.startswith(tag.split(":")[0] + ":"):
                return Check(f"model: {tag}", OK, n)
        return Check(f"model: {tag}", FAIL,
                     f"not pulled (have: {', '.join(names) or 'none'})",
                     f"ollama pull {tag}")
    except Exception as e:
        return Check(f"model: {tag}", FAIL, str(e))


def check_display() -> Check:
    sysname = platform.system()
    if sysname == "Darwin":
        return Check("display", OK, "macOS (Quartz)")
    disp = os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")
    if disp:
        return Check("display", OK, f"DISPLAY={disp}")
    return Check("display", WARN, "no DISPLAY/WAYLAND_DISPLAY — GUI tools will not work",
                 "run from a desktop session, not SSH/headless")


def check_gui_libs() -> Check:
    try:
        import pyautogui  # noqa: F401
        try:
            import pyautogui as pg
            w, h = pg.size()
            return Check("pyautogui", OK, f"screen {w}x{h}")
        except Exception as e:
            return Check("pyautogui", WARN, f"imports but screen probe failed: {e}",
                         "on macOS: System Settings → Privacy → Accessibility → enable your terminal")
    except ImportError:
        return Check("pyautogui", FAIL, "not installed",
                     "pip install pyautogui Pillow")


def check_tool_call_chat(host: str, model: str) -> Check:
    """Issue a real chat request with a trivial tool and confirm the model emits a tool_call."""
    try:
        import ollama
    except ImportError:
        return Check(f"live tool-call: {model}", FAIL, "ollama python pkg missing")

    schema = {
        "type": "function",
        "function": {
            "name": "ping",
            "description": "Returns 'pong'. Call this to verify tool calling.",
            "parameters": {"type": "object", "properties": {}},
        },
    }
    try:
        client = ollama.Client(host=host)
        t0 = time.time()
        resp = client.chat(
            model=model,
            messages=[
                {"role": "system", "content": "You must call the ping tool, then say 'done'."},
                {"role": "user", "content": "call ping"},
            ],
            tools=[schema],
            options={"temperature": 0.0, "num_ctx": 2048},
        )
        dt = time.time() - t0
        msg = resp["message"] if isinstance(resp, dict) else resp.message
        tcs = (msg.get("tool_calls") if isinstance(msg, dict)
               else getattr(msg, "tool_calls", None)) or []
        if tcs:
            return Check(f"live tool-call: {model}", OK,
                         f"emitted {len(tcs)} tool_call in {dt:.1f}s")
        content = (msg.get("content") if isinstance(msg, dict) else msg.content) or ""
        return Check(f"live tool-call: {model}", WARN,
                     f"no tool_call (text='{content[:60]}...') in {dt:.1f}s",
                     "model may not support tools — pick llama3.1:8b or llama3.2")
    except Exception as e:
        return Check(f"live tool-call: {model}", FAIL, f"{type(e).__name__}: {e}")


def check_vision(host: str, model: str) -> Check:
    """Send a tiny 8x8 red PNG to the vision model and check we get a description back."""
    try:
        import base64
        import io
        try:
            from PIL import Image
        except ImportError:
            return Check(f"live vision: {model}", FAIL, "Pillow not installed")
        try:
            import ollama
        except ImportError:
            return Check(f"live vision: {model}", FAIL, "ollama python pkg missing")

        img = Image.new("RGB", (32, 32), color=(220, 30, 30))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode()

        client = ollama.Client(host=host)
        t0 = time.time()
        resp = client.chat(
            model=model,
            messages=[{"role": "user", "content": "What color is this image? Answer in one word.",
                       "images": [b64]}],
            options={"temperature": 0.0},
        )
        dt = time.time() - t0
        msg = resp["message"] if isinstance(resp, dict) else resp.message
        content = (msg.get("content") if isinstance(msg, dict) else msg.content) or ""
        ok_red = "red" in content.lower()
        status = OK if ok_red else WARN
        return Check(f"live vision: {model}", status,
                     f"reply='{content.strip()[:80]}' in {dt:.1f}s")
    except Exception as e:
        return Check(f"live vision: {model}", FAIL, f"{type(e).__name__}: {e}")


def run(host: str = "http://localhost:11434",
        brain: str = "llama3.1:8b",
        vision: str = "llava:7b") -> int:
    print(f"\n{GREEN}llamaos doctor{RESET}\n" + "=" * 40)

    checks = [
        check_python(),
        check_pkg("ollama"),
        check_pkg("psutil"),
        check_pkg("Pillow", "PIL"),
        check_pkg("pyautogui"),
        check_ollama_cli(),
        check_ollama_daemon(host),
        check_display(),
        check_gui_libs(),
    ]
    print()
    for c in checks:
        print(f"  [{c.status}] {c.name}")
        if c.detail:
            print(f"        {GREY}{c.detail}{RESET}")
        if "FAIL" in c.status and c.fix:
            print(f"        {YELLOW}fix:{RESET} {c.fix}")

    daemon_ok = "OK" in checks[6].status
    if not daemon_ok:
        print(f"\n{YELLOW}ollama daemon unreachable — skipping live model checks.{RESET}")
        print(f"{GREY}start it with: ollama serve{RESET}\n")
        return 1

    print(f"\n{GREY}--- live model checks ---{RESET}")
    live = [
        check_model(host, brain),
        check_model(host, vision),
    ]
    for c in live:
        print(f"  [{c.status}] {c.name}")
        if c.detail:
            print(f"        {GREY}{c.detail}{RESET}")
        if "FAIL" in c.status and c.fix:
            print(f"        {YELLOW}fix:{RESET} {c.fix}")

    brain_pulled = "OK" in live[0].status
    vision_pulled = "OK" in live[1].status

    if brain_pulled:
        print()
        c = check_tool_call_chat(host, brain)
        print(f"  [{c.status}] {c.name}")
        print(f"        {GREY}{c.detail}{RESET}")
        if c.fix:
            print(f"        {YELLOW}fix:{RESET} {c.fix}")

    if vision_pulled:
        print()
        c = check_vision(host, vision)
        print(f"  [{c.status}] {c.name}")
        print(f"        {GREY}{c.detail}{RESET}")

    print()
    failed = sum(1 for c in checks + live if "FAIL" in c.status)
    if failed == 0:
        print(f"{GREEN}all systems go.{RESET} run: ./run.sh\n")
        return 0
    print(f"{RED}{failed} check(s) failed — fix those first.{RESET}\n")
    return 1


if __name__ == "__main__":
    sys.exit(run())
