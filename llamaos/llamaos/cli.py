"""LlamaOS interactive CLI."""

from __future__ import annotations

import argparse
import sys

from .agent import Agent, AgentConfig

BANNER = r"""
   _      _                    ___  ___
  | |    | |                  / _ \/ __|
  | |    | | __ _ _ __ ___   / /_\ \\__ \
  | |    | |/ _` | '_ ` _ \  |  _  |__) |
  | |____| | (_| | | | | | | | | | |___/
  \_____/|_|\__,_|_| |_| |_|\_| |_/____/

  Llama 3.1 8B is now embedded in your laptop.
"""


def main() -> int:
    p = argparse.ArgumentParser(prog="llamaos", description="Llama 3.1 8B as a local OS agent.")
    p.add_argument("--model", default="llama3.1:8b", help="Ollama model tag")
    p.add_argument("--host", default="http://localhost:11434", help="Ollama host URL")
    p.add_argument("--yolo", action="store_true", help="Skip confirmation prompts for destructive tools")
    p.add_argument("--quiet", action="store_true", help="Suppress per-step trace output")
    p.add_argument("--max-steps", type=int, default=12, help="Max tool-use steps per task")
    p.add_argument("--doctor", action="store_true", help="Run environment + live Ollama checks and exit")
    p.add_argument("-c", "--command", help="Run one task non-interactively and exit")
    args = p.parse_args()

    if args.doctor:
        from .doctor import run as doctor_run
        return doctor_run(host=args.host, brain=args.model)

    agent = Agent(AgentConfig(
        model=args.model,
        host=args.host,
        yolo=args.yolo,
        verbose=not args.quiet,
        max_steps=args.max_steps,
    ))

    if args.command:
        reply = agent.send(args.command)
        if reply:
            print(f"\n{reply}")
        return 0

    print(BANNER)
    print(f"  model: {args.model}   yolo: {args.yolo}   host: {args.host}")
    print("  type 'exit' to quit, Ctrl-C to interrupt a task.\n")
    while True:
        try:
            line = input("\x1b[32mllamaos>\x1b[0m ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not line:
            continue
        if line in ("exit", "quit", ":q"):
            break
        try:
            reply = agent.send(line)
        except KeyboardInterrupt:
            print("\n[interrupted]")
            continue
        except Exception as e:
            print(f"\n\x1b[31merror: {type(e).__name__}: {e}\x1b[0m\n")
            continue
        if reply:
            print(f"\n{reply}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
