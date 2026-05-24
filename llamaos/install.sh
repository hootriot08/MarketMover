#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "[llamaos] installing..."

if ! command -v ollama >/dev/null 2>&1; then
  echo "[llamaos] installing ollama..."
  curl -fsSL https://ollama.ai/install.sh | sh
fi

if ! pgrep -x ollama >/dev/null 2>&1; then
  echo "[llamaos] starting ollama daemon (logs: /tmp/ollama.log)..."
  (nohup ollama serve >/tmp/ollama.log 2>&1 &)
  sleep 3
fi

if ! ollama list 2>/dev/null | grep -q "llama3.1:8b"; then
  echo "[llamaos] pulling llama3.1:8b (~4.7 GB)..."
  ollama pull llama3.1:8b
fi

if [ ! -d ".venv" ]; then
  echo "[llamaos] creating venv..."
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt

echo "[llamaos] ready. launch: ./run.sh"
