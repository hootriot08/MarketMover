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
| `click`          | Click the mouse at (x, y)                             |
| `move_mouse`     | Move the cursor                                       |
| `type_text`      | Type a string at the focused control                  |
| `hotkey`         | Press key combinations (`ctrl+c`, `cmd+space`, etc.)  |
| `mouse_position` | Read the current cursor position                      |

## Install

```bash
cd llamaos
./install.sh
```

The installer will:
1. Install Ollama if missing.
2. Start `ollama serve` in the background.
3. Pull `llama3.1:8b` (~4.7 GB).
4. Create a Python venv and install dependencies.

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

## Limitations

- **Llama 3.1 8B is text-only.** `screenshot` saves a PNG to disk but the model
  cannot see it. To give the agent vision, point `--model` at a multimodal
  model (e.g. `llava:13b`) and adapt the agent to forward image bytes.
- GUI tools (`pyautogui`) require a display server. On headless Linux they
  return `{"error": "GUI unavailable: ..."}`.
- This is not a kernel and does not boot a machine. Building an actual bootable
  OS distribution with Llama embedded is a separate effort (Buildroot or
  Debian live-build) and is not included here.
