"""End-to-end smoke tests for llamaos.

Exercises every tool that can run without a display and without a real
Ollama daemon. The agent loop is tested against a mocked Ollama client
that returns a scripted sequence of tool calls — proving the dispatch,
safety gate, message threading, and tool-result feedback all work.

Run: python -m pytest tests/ -v
     or: python tests/test_smoke.py
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from llamaos.agent import Agent, AgentConfig
from llamaos.tools import REGISTRY, call as tool_call, schemas
from llamaos.tools import fs, shell, system

PASS = "\x1b[32mPASS\x1b[0m"
FAIL = "\x1b[31mFAIL\x1b[0m"


def assert_eq(label, got, want):
    if got == want:
        print(f"  {PASS} {label}")
        return True
    print(f"  {FAIL} {label}: got={got!r} want={want!r}")
    return False


def assert_true(label, cond, detail=""):
    if cond:
        print(f"  {PASS} {label}")
        return True
    print(f"  {FAIL} {label}{(' — ' + detail) if detail else ''}")
    return False


# ---------------------------------------------------------------- tool tests

def test_registry():
    print("\n[registry]")
    names = list(REGISTRY.keys())
    expected = {
        "shell", "read_file", "write_file", "list_dir",
        "system_info", "processes", "network",
        "screenshot", "see_screen", "click", "move_mouse",
        "type_text", "hotkey", "mouse_position",
    }
    ok = assert_eq("14 tools registered", set(names), expected)
    ok &= assert_eq("schemas() returns 14", len(schemas()), 14)
    for s in schemas():
        ok &= assert_true(
            f"schema[{s['function']['name']}] well-formed",
            s.get("type") == "function" and "parameters" in s["function"],
        )
    return ok


def test_shell():
    print("\n[shell]")
    r = shell.call({"command": "echo hello"})
    ok = assert_eq("echo exit_code", r["exit_code"], 0)
    ok &= assert_true("echo stdout", "hello" in r["stdout"])

    r = shell.call({"command": "exit 7"})
    ok &= assert_eq("exit 7 propagates", r["exit_code"], 7)

    r = shell.call({"command": "sleep 10", "timeout": 1})
    ok &= assert_true("timeout flagged", r["timed_out"])
    return ok


def test_fs():
    print("\n[fs]")
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "sub" / "hello.txt"
        r = fs.write_file(str(p), "alpha\n")
        ok = assert_eq("write bytes_written", r["bytes_written"], 6)
        ok &= assert_true("parent created", p.parent.is_dir())

        r = fs.write_file(str(p), "beta\n", append=True)
        ok &= assert_eq("append mode", r["mode"], "a")

        r = fs.read_file(str(p))
        ok &= assert_eq("read content", r["content"], "alpha\nbeta\n")

        r = fs.read_file(str(Path(d) / "missing"))
        ok &= assert_true("missing -> error", "error" in r)

        r = fs.list_dir(d)
        ok &= assert_true("list_dir count >= 1", r["count"] >= 1)
    return ok


def test_system():
    print("\n[system]")
    info = system.system_info()
    ok = assert_true("os present", isinstance(info.get("os"), str) and info["os"])
    ok &= assert_true("cpu_percent numeric", isinstance(info.get("cpu_percent"), (int, float)))
    ok &= assert_true("memory_total_gb > 0", info.get("memory_total_gb", 0) > 0)

    procs = system.processes(top_n=3, sort_by="memory")
    ok &= assert_eq("processes sorted_by", procs["sorted_by"], "memory")
    ok &= assert_true("processes returned", len(procs["top"]) > 0)

    net = system.network()
    ok &= assert_true("interfaces present", len(net["interfaces"]) > 0)
    return ok


def test_safety_gate():
    print("\n[safety]")
    from llamaos import safety
    ok = assert_true("shell needs confirm", safety.needs_confirmation("shell", {}, yolo=False))
    ok &= assert_true("yolo bypasses", not safety.needs_confirmation("shell", {}, yolo=True))
    ok &= assert_true("read_file no confirm", not safety.needs_confirmation("read_file", {}, yolo=False))
    ok &= assert_true("write_file needs confirm", safety.needs_confirmation("write_file", {}, yolo=False))
    ok &= assert_true("see_screen no confirm", not safety.needs_confirmation("see_screen", {}, yolo=False))
    return ok


def test_unknown_tool():
    print("\n[dispatch]")
    r = tool_call("does_not_exist", {})
    ok = assert_true("unknown -> error", "error" in r)
    r = tool_call("read_file", {"path": "/no/such/file/here"})
    ok &= assert_true("read missing -> error key", "error" in r)
    return ok


# ----------------------------------------------------------- agent loop test

class FakeMessage:
    def __init__(self, content=None, tool_calls=None):
        self.role = "assistant"
        self.content = content
        self.tool_calls = tool_calls


class FakeToolCall:
    def __init__(self, name, args):
        self.function = type("F", (), {"name": name, "arguments": args})


class FakeOllama:
    """Scripts a sequence of model responses for the agent loop test."""
    def __init__(self, script):
        self.script = list(script)
        self.calls = []

    def chat(self, model, messages, tools, options):
        self.calls.append({"model": model, "n_messages": len(messages), "n_tools": len(tools)})
        if not self.script:
            return {"message": FakeMessage(content="done.")}
        nxt = self.script.pop(0)
        return {"message": nxt}


def test_agent_loop():
    print("\n[agent loop, mocked ollama]")

    script = [
        FakeMessage(tool_calls=[FakeToolCall("system_info", {})]),
        FakeMessage(tool_calls=[FakeToolCall("processes", {"top_n": 2, "sort_by": "cpu"})]),
        FakeMessage(content="Your CPU is at X%, top process is Y."),
    ]
    fake = FakeOllama(script)

    agent = Agent(AgentConfig(yolo=True, verbose=False, max_steps=5))
    with patch.object(agent, "_client", return_value=fake):
        reply = agent.send("what's running?")

    ok = assert_true("agent returned final text", "CPU" in reply or "process" in reply)
    ok &= assert_eq("3 ollama calls", len(fake.calls), 3)
    # message log: system, user, assistant(tc), tool, assistant(tc), tool, assistant(final)
    roles = [m["role"] for m in agent.messages]
    ok &= assert_eq("role sequence", roles, ["system", "user", "assistant", "tool", "assistant", "tool", "assistant"])
    # tool result must be valid JSON
    for m in agent.messages:
        if m["role"] == "tool":
            try:
                json.loads(m["content"])
                ok &= assert_true(f"tool[{m.get('name')}] json valid", True)
            except json.JSONDecodeError as e:
                ok &= assert_true(f"tool[{m.get('name')}] json valid", False, str(e))
    return ok


def test_agent_confirm_denial():
    print("\n[agent loop, confirmation denial]")
    script = [
        FakeMessage(tool_calls=[FakeToolCall("shell", {"command": "rm -rf /"})]),
        FakeMessage(content="Cancelled by user."),
    ]
    fake = FakeOllama(script)
    agent = Agent(AgentConfig(yolo=False, verbose=False, max_steps=3))

    with patch.object(agent, "_client", return_value=fake), \
         patch("llamaos.safety.confirm", return_value=False):
        reply = agent.send("delete everything")

    tool_msg = next((m for m in agent.messages if m["role"] == "tool"), None)
    ok = assert_true("tool message present", tool_msg is not None)
    payload = json.loads(tool_msg["content"]) if tool_msg else {}
    ok &= assert_eq("denial recorded", payload.get("error"), "user denied")
    ok &= assert_true("agent did not run rm -rf", "Cancel" in reply or reply == "Cancelled by user.")
    return ok


def main():
    tests = [
        test_registry,
        test_shell,
        test_fs,
        test_system,
        test_safety_gate,
        test_unknown_tool,
        test_agent_loop,
        test_agent_confirm_denial,
    ]
    results = [t() for t in tests]
    total = len(results)
    passed = sum(results)
    print(f"\n{'='*40}")
    print(f"  {passed}/{total} test groups passed")
    print(f"{'='*40}")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
