"""LlamaOS agent: Ollama chat loop with tool execution."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any

from . import safety
from .prompts import SYSTEM
from .tools import call as tool_call
from .tools import schemas


@dataclass
class AgentConfig:
    model: str = "llama3.1:8b"
    host: str = "http://localhost:11434"
    yolo: bool = False
    max_steps: int = 12
    temperature: float = 0.2
    num_ctx: int = 8192
    verbose: bool = True


def _extract_tool_call(tc: Any) -> tuple[str, dict]:
    """Normalize a tool call across ollama-python response shapes."""
    if isinstance(tc, dict):
        fn = tc.get("function") or {}
        name = fn.get("name") or ""
        args = fn.get("arguments") or {}
    else:
        fn = getattr(tc, "function", None)
        name = getattr(fn, "name", "") if fn else ""
        args = getattr(fn, "arguments", {}) if fn else {}
    if isinstance(args, str):
        try:
            args = json.loads(args)
        except json.JSONDecodeError:
            args = {"_raw": args}
    return name, args or {}


def _msg_to_dict(msg: Any) -> dict:
    if isinstance(msg, dict):
        return msg
    out: dict = {"role": getattr(msg, "role", "assistant")}
    content = getattr(msg, "content", None)
    if content:
        out["content"] = content
    tcs = getattr(msg, "tool_calls", None)
    if tcs:
        out["tool_calls"] = [
            {"function": {"name": n, "arguments": a}}
            for n, a in (_extract_tool_call(tc) for tc in tcs)
        ]
    return out


@dataclass
class Agent:
    config: AgentConfig = field(default_factory=AgentConfig)
    messages: list[dict] = field(default_factory=list)

    _cached_client: Any = None

    def __post_init__(self) -> None:
        if not self.messages:
            self.messages.append({"role": "system", "content": SYSTEM})

    def _client(self):
        if self._cached_client is None:
            import ollama
            self._cached_client = ollama.Client(host=self.config.host)
        return self._cached_client

    def send(self, user_input: str) -> str:
        self.messages.append({"role": "user", "content": user_input})
        return self._loop()

    def _loop(self) -> str:
        client = self._client()
        tools = schemas()
        for _ in range(self.config.max_steps):
            t0 = time.time()
            resp = client.chat(
                model=self.config.model,
                messages=self.messages,
                tools=tools,
                options={"temperature": self.config.temperature, "num_ctx": self.config.num_ctx},
            )
            dt = time.time() - t0

            raw_msg = resp["message"] if isinstance(resp, dict) else resp.message
            msg = _msg_to_dict(raw_msg)
            self.messages.append(msg)

            raw_tcs = (raw_msg.get("tool_calls") if isinstance(raw_msg, dict)
                       else getattr(raw_msg, "tool_calls", None)) or []

            if self.config.verbose:
                content = (msg.get("content") or "").strip()
                if content:
                    print(f"\x1b[36m{content}\x1b[0m")
                print(f"\x1b[90m  ({dt:.1f}s · {len(raw_tcs)} tool call{'s' if len(raw_tcs) != 1 else ''})\x1b[0m")

            if not raw_tcs:
                return msg.get("content") or ""

            for tc in raw_tcs:
                name, args = _extract_tool_call(tc)
                if self.config.verbose:
                    arg_preview = json.dumps(args, default=str)
                    if len(arg_preview) > 200:
                        arg_preview = arg_preview[:200] + "..."
                    print(f"\x1b[35m→ {name}({arg_preview})\x1b[0m")

                if safety.needs_confirmation(name, args, self.config.yolo):
                    if not safety.confirm(name, args):
                        result: Any = {"error": "user denied"}
                    else:
                        result = tool_call(name, args)
                else:
                    result = tool_call(name, args)

                payload = json.dumps(result, default=str)
                if len(payload) > 8000:
                    payload = payload[:8000] + "...<truncated>"

                self.messages.append({
                    "role": "tool",
                    "name": name,
                    "content": payload,
                })

        return "[llamaos: max_steps reached]"
