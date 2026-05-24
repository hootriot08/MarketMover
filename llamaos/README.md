# LlamaOS

Llama 3.1 8B, running locally, with direct control of your laptop.

LlamaOS is not a kernel — it is an agent layer that sits on top of your existing
OS (Linux or macOS) and gives a local Llama 3.1 8B model the ability to **see and
control all aspects of the machine** through native tool calls: shell,
filesystem, processes, network, screen, mouse, and keyboard.

The model runs locally via [Ollama](https://ollama.ai). Nothing is sent off-box.

## Capabilities

| Tool             | What Llama can do                                     |
|------------------|-------------------------------------------------------|
| `shell`          | Run any bash command                                  |
| `read_file`      | Read text files (up to 200 KB)                        |
| `write_file`     | Write/append to files, creating parent dirs           |
| `list_dir`       | List directory contents                               |
| `system_info`    | CPU %, memory, disk, OS, load average                 |
| `processes`      | Top processes by CPU or memory                        |
| `network`        | Interfaces, addresses, per-NIC IO counters            |
| `screenshot`     | Capture the screen (or a region) to PNG               |
| `see_screen`     | Capture + ask **llava** to describe what's visible    |
| `click`          | Click the mouse at (x, y)                             |
| `move_mouse`     | Move the cursor                                       |
| `type_text`      | Type a string at the focused control                  |
| `hotkey`         | Press key combinations (`ctrl+c`, `cmd+space`, etc.)  |
| `mouse_position` | Read the current cursor position                      |

## Install — on your laptop

Open a terminal on the actual machine you want Llama to control (macOS or Linux),
then:

```bash
git clone https://github.com/hootriot08/MarketMover.git
cd MarketMover/llamaos
./install.sh
```

The installer is idempotent and:
1. Installs Ollama (via `brew` on macOS, official script on Linux) if missing.
2. Starts the `ollama` daemon if it isn't already running.
3. Pulls `llama3.1:8b` (~4.7 GB) — the tool-calling brain.
4. Pulls `llava:7b` (~4.5 GB) — the vision oracle. Set `LLAMAOS_SKIP_VISION=1` to skip.
5. Creates `.venv` and installs Python dependencies.
6. Runs `./run.sh --doctor` to verify the full stack (daemon up, models pulled,
   real tool-call works against Llama 3.1, real vision works against Llava).

### macOS note

For mouse/keyboard control to work, grant **Accessibility** permission to your
terminal app: System Settings → Privacy & Security → Accessibility → add iTerm
(or Terminal). Without it, `pyautogui` clicks are silently ignored.

### Verify everything works

```bash
./run.sh --doctor   # ~10 second sanity check
python3 tests/test_live.py   # real end-to-end against your Ollama
```

## Run

Interactive:

```bash
./run.sh
```

One-shot:

```bash
./run.sh -c "what's eating my CPU right now?"
./run.sh -c "find every TODO under ~/projects from the last 7 days"
./run.sh -c "open a terminal, run htop, take a screenshot" --yolo
```

## Flags

| Flag             | Default                       | Meaning                                       |
|------------------|-------------------------------|-----------------------------------------------|
| `--model`        | `llama3.1:8b`                 | Ollama model tag                              |
| `--host`         | `http://localhost:11434`      | Ollama daemon URL                             |
| `--yolo`         | off                           | Skip confirmation on destructive tools        |
| `--quiet`        | off                           | Suppress per-step trace                       |
| `--max-steps`    | `12`                          | Max tool-use rounds per task                  |
| `-c, --command`  | —                             | Run one task and exit                         |

## Safety

By default, **destructive or visible-side-effect tools require confirmation**:

- `shell`, `write_file`
- `click`, `move_mouse`, `type_text`, `hotkey`

Read-only tools (`read_file`, `list_dir`, `system_info`, `processes`,
`network`, `screenshot`, `mouse_position`) run without prompting.

`--yolo` disables all confirmation. Use deliberately.

## Example session

```
llamaos> what's running and using the most memory?
→ processes({"sort_by": "memory", "top_n": 5})
Top memory consumers: Chrome (18%), Slack (6%), Code (4%), Spotify (3%), iTerm (2%).

llamaos> kill the spotify processes
[confirm] shell({"command": "pkill -f Spotify"})
execute? [y/N] y
→ shell({"command": "pkill -f Spotify"})
Done. Spotify is no longer running.
```

## Architecture

```
llamaos/
├── install.sh              # one-shot setup (ollama + venv + deps)
├── run.sh                  # launcher
├── requirements.txt
└── llamaos/
    ├── __main__.py         # python -m llamaos entry
    ├── cli.py              # REPL + arg parsing
    ├── agent.py            # ollama chat loop + tool dispatch
    ├── prompts.py          # system prompt
    ├── safety.py           # confirm-gate for dangerous tools
    └── tools/
        ├── __init__.py     # tool registry
        ├── shell.py
        ├── fs.py
        ├── system.py
        └── gui.py
```

The agent uses Ollama's **native tool-calling** support in Llama 3.1, so tool
calls are structured JSON — no regex parsing of model output.

## Vision via llava

Llama 3.1 8B is text-only, so it can't see screenshots directly. Llava can't
reliably do tool calls. The pattern used here keeps the strengths of both:

- **llama3.1:8b** is the brain — it plans and calls tools.
- **llava:7b** is a vision oracle, called on-demand via the `see_screen` tool.

When the agent needs to know what's on screen, it calls `see_screen(query=...)`.
That tool captures the screen, sends the PNG to llava with the query, and
returns llava's text answer as a normal tool result. The brain then decides
where to click / what to type based on llava's description.

Override the vision model:
```bash
LLAMAOS_VISION_MODEL=llava:13b ./run.sh
```

Skip the llava pull entirely (smaller install, no `see_screen`):
```bash
LLAMAOS_SKIP_VISION=1 ./install.sh
```

## Tests

```bash
python3 tests/test_smoke.py
```

41 assertions covering tool registry, real shell/fs/system execution, the
safety gate, and the full agent loop against a mocked Ollama.

## Limitations
- GUI tools (`pyautogui`) require a display server. On headless Linux they
  return `{"error": "GUI unavailable: ..."}`.
- This is not a kernel and does not boot a machine. Building an actual bootable
  OS distribution with Llama embedded is a separate effort (Buildroot or
  Debian live-build) and is not included here.
