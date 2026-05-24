#!/usr/bin/env bash
# llamaos installer — works on macOS and Linux, idempotent.
set -euo pipefail
cd "$(dirname "$0")"

GREEN='\033[32m'; YELLOW='\033[33m'; RED='\033[31m'; GREY='\033[90m'; RESET='\033[0m'
say() { printf "${GREEN}[llamaos]${RESET} %s\n" "$*"; }
warn() { printf "${YELLOW}[llamaos]${RESET} %s\n" "$*"; }
fail() { printf "${RED}[llamaos]${RESET} %s\n" "$*"; exit 1; }

OS="$(uname -s)"

# --------------------------------------------------------------- 1) ollama CLI
if ! command -v ollama >/dev/null 2>&1; then
  case "$OS" in
    Darwin)
      if command -v brew >/dev/null 2>&1; then
        say "installing ollama via brew..."
        brew install ollama
      else
        warn "homebrew not found. Install Ollama for Mac: https://ollama.ai/download"
        fail "ollama is required"
      fi
      ;;
    Linux)
      say "installing ollama via official script..."
      curl -fsSL https://ollama.ai/install.sh | sh
      ;;
    *)
      fail "unsupported OS: $OS — install ollama manually from https://ollama.ai/download"
      ;;
  esac
else
  say "ollama already installed: $(ollama --version 2>&1 | head -1)"
fi

# --------------------------------------------------------------- 2) ollama daemon
HOST="${OLLAMA_HOST:-http://localhost:11434}"
if curl -fsS --max-time 2 "$HOST/api/version" >/dev/null 2>&1; then
  say "ollama daemon reachable at $HOST"
else
  say "starting ollama daemon (logs: /tmp/ollama.log)..."
  if [ "$OS" = "Darwin" ] && command -v brew >/dev/null 2>&1 && brew services list 2>/dev/null | grep -q ollama; then
    brew services start ollama || true
  else
    nohup ollama serve >/tmp/ollama.log 2>&1 &
  fi
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS --max-time 1 "$HOST/api/version" >/dev/null 2>&1; then
      say "ollama is up."
      break
    fi
    sleep 1
  done
  if ! curl -fsS --max-time 1 "$HOST/api/version" >/dev/null 2>&1; then
    fail "ollama daemon did not come up. Check /tmp/ollama.log"
  fi
fi

# --------------------------------------------------------------- 3) models
pull_if_missing() {
  local tag="$1"
  if ollama list 2>/dev/null | awk 'NR>1 {print $1}' | grep -qx "$tag"; then
    say "model present: $tag"
  else
    say "pulling $tag ..."
    ollama pull "$tag"
  fi
}

pull_if_missing "llama3.1:8b"
if [ "${LLAMAOS_SKIP_VISION:-0}" != "1" ]; then
  pull_if_missing "llava:7b"
fi

# --------------------------------------------------------------- 4) python venv
PY="${PYTHON:-python3}"
if ! command -v "$PY" >/dev/null 2>&1; then
  fail "python3 not found — install Python 3.10+"
fi

if [ ! -d .venv ]; then
  say "creating venv (.venv) ..."
  "$PY" -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q --upgrade pip
say "installing python deps ..."
pip install -q -r requirements.txt

# --------------------------------------------------------------- 5) verify
say "running doctor ..."
python -m llamaos --doctor --model llama3.1:8b --host "$HOST" || warn "some checks did not pass — see above"

cat <<EOF

${GREEN}done.${RESET}

  launch interactive:   ${GREY}./run.sh${RESET}
  one-shot:             ${GREY}./run.sh -c "what's eating my CPU?"${RESET}
  full autonomy:        ${GREY}./run.sh --yolo${RESET}
  re-run diagnostics:   ${GREY}./run.sh --doctor${RESET}

EOF
