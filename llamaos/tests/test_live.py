"""Live end-to-end tests against a real Ollama daemon.

Skips automatically if Ollama isn't reachable. On your laptop with
`ollama serve` running and the models pulled, this proves the whole
stack works for real.

Run: python tests/test_live.py
"""

from __future__ import annotations

import base64
import io
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
BRAIN = os.environ.get("LLAMAOS_MODEL", "llama3.1:8b")
VISION = os.environ.get("LLAMAOS_VISION_MODEL", "llava:7b")

GREEN, RED, YELLOW, GREY, RESET = "\x1b[32m", "\x1b[31m", "\x1b[33m", "\x1b[90m", "\x1b[0m"


def header(s):
    print(f"\n{GREEN}[live]{RESET} {s}")


def ok(s, detail=""):
    print(f"  {GREEN}PASS{RESET} {s}" + (f" {GREY}— {detail}{RESET}" if detail else ""))


def bad(s, detail=""):
    print(f"  {RED}FAIL{RESET} {s}" + (f" {GREY}— {detail}{RESET}" if detail else ""))


def skip(reason):
    print(f"{YELLOW}[skip]{RESET} {reason}")
    sys.exit(0)


def daemon_reachable() -> bool:
    try:
        with urllib.request.urlopen(f"{HOST}/api/version", timeout=2) as r:
            r.read()
        return True
    except Exception:
        return False


def models_present() -> set[str]:
    try:
        with urllib.request.urlopen(f"{HOST}/api/tags", timeout=5) as r:
            data = json.loads(r.read().decode())
        return {m.get("name", "") for m in data.get("models", [])}
    except Exception:
        return set()


def test_tool_call_roundtrip(client):
    """Brain emits a tool call, we run it, feed result back, brain responds."""
    header(f"tool-call round trip ({BRAIN})")
    from llamaos.tools import call as tool_call
    from llamaos.tools import schemas as tool_schemas

    messages = [
        {"role": "system", "content":
            "You are a local OS agent. When asked about system state, "
            "call the appropriate tool. Be terse."},
        {"role": "user", "content": "How much memory does this machine have?"},
    ]

    t0 = time.time()
    resp = client.chat(model=BRAIN, messages=messages, tools=tool_schemas(),
                       options={"temperature": 0.1})
    dt = time.time() - t0

    msg = resp["message"] if isinstance(resp, dict) else resp.message
    tcs = (msg.get("tool_calls") if isinstance(msg, dict)
           else getattr(msg, "tool_calls", None)) or []

    if not tcs:
        bad("brain emitted tool_call", f"got text: {(msg.get('content') or '')[:80]}")
        return False
    ok(f"brain emitted {len(tcs)} tool_call in {dt:.1f}s")

    tc = tcs[0]
    if isinstance(tc, dict):
        name, args = tc["function"]["name"], tc["function"].get("arguments") or {}
    else:
        name = tc.function.name
        args = tc.function.arguments or {}
    if isinstance(args, str):
        args = json.loads(args)
    ok(f"tool called: {name}({json.dumps(args)})")

    result = tool_call(name, args)
    ok(f"tool ran", f"keys: {list(result.keys()) if isinstance(result, dict) else type(result).__name__}")

    messages.append({"role": "assistant", "content": msg.get("content") if isinstance(msg, dict) else msg.content,
                     "tool_calls": [{"function": {"name": name, "arguments": args}}]})
    messages.append({"role": "tool", "name": name, "content": json.dumps(result, default=str)[:4000]})

    t0 = time.time()
    resp2 = client.chat(model=BRAIN, messages=messages, tools=tool_schemas(),
                        options={"temperature": 0.1})
    dt2 = time.time() - t0
    final = resp2["message"] if isinstance(resp2, dict) else resp2.message
    final_text = (final.get("content") if isinstance(final, dict) else final.content) or ""
    ok(f"brain summarized in {dt2:.1f}s", f"'{final_text[:120]}'")
    return True


def test_vision(client):
    header(f"vision ({VISION})")
    try:
        from PIL import Image
    except ImportError:
        bad("Pillow not installed")
        return False

    img = Image.new("RGB", (64, 64), (30, 200, 80))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()

    t0 = time.time()
    resp = client.chat(
        model=VISION,
        messages=[{"role": "user", "content": "What color is this image? One word.",
                   "images": [b64]}],
        options={"temperature": 0.0},
    )
    dt = time.time() - t0
    msg = resp["message"] if isinstance(resp, dict) else resp.message
    content = ((msg.get("content") if isinstance(msg, dict) else msg.content) or "").strip()
    if "green" in content.lower():
        ok(f"vision identified green in {dt:.1f}s", f"reply='{content[:80]}'")
        return True
    bad(f"vision did not say 'green'", f"reply='{content[:80]}'")
    return False


def test_full_agent(client):
    """Real Agent against real Ollama — the actual product."""
    header("full agent loop (real ollama, --yolo)")
    from llamaos.agent import Agent, AgentConfig

    agent = Agent(AgentConfig(model=BRAIN, host=HOST, yolo=True, verbose=False, max_steps=6))
    t0 = time.time()
    reply = agent.send("Use the system_info tool to report this machine's OS and total memory in one short sentence.")
    dt = time.time() - t0

    tool_msgs = [m for m in agent.messages if m["role"] == "tool"]
    if not tool_msgs:
        bad("agent did not use any tools", f"reply='{reply[:120]}'")
        return False
    ok(f"agent used {len(tool_msgs)} tool(s) in {dt:.1f}s", f"tools: {[m.get('name') for m in tool_msgs]}")
    ok("final reply", f"'{reply[:160]}'")
    return True


def main() -> int:
    if not daemon_reachable():
        skip(f"ollama daemon not reachable at {HOST} — start it with `ollama serve`")

    try:
        import ollama
    except ImportError:
        skip("ollama python package missing — pip install ollama")

    client = ollama.Client(host=HOST)

    available = models_present()
    print(f"{GREY}models available: {sorted(available) or '(none)'}{RESET}")

    results = []
    if BRAIN in available or any(m.startswith(BRAIN.split(":")[0] + ":") for m in available):
        results.append(test_tool_call_roundtrip(client))
        results.append(test_full_agent(client))
    else:
        print(f"{YELLOW}[skip]{RESET} {BRAIN} not pulled — `ollama pull {BRAIN}`")

    if VISION in available or any(m.startswith(VISION.split(":")[0] + ":") for m in available):
        results.append(test_vision(client))
    else:
        print(f"{YELLOW}[skip]{RESET} {VISION} not pulled — `ollama pull {VISION}`")

    if not results:
        print(f"\n{YELLOW}no models tested.{RESET}")
        return 1
    passed = sum(results)
    print(f"\n{'='*40}\n  {passed}/{len(results)} live tests passed\n{'='*40}")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
