#!/bin/bash

echo "🚀 Setting up Ollama for MarketMover Financial Analysis"
echo "=================================================="

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "📦 Installing Ollama..."
    curl -fsSL https://ollama.ai/install.sh | sh
else
    echo "✅ Ollama is already installed"
fi

# Start Ollama service
echo "🔄 Starting Ollama service..."
ollama serve &

# Wait for service to start
sleep 3

# Check if llama3 model is available
echo "🔍 Checking for LLaMA 3 model..."
if ollama list | grep -q "llama3"; then
    echo "✅ LLaMA 3 model is already available"
else
    echo "📥 Downloading LLaMA 3 model (this may take a few minutes)..."
    ollama pull llama3
fi

echo ""
echo "🎉 Setup complete! Your enhanced financial analysis system is ready."
echo ""
echo "To start development:"
echo "  npm run dev"
echo ""
echo "To test the API:"
echo "  curl -X POST http://localhost:3001/analyze \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"ticker\": \"AAPL\", \"timeframe\": \"1 week\"}'"
echo ""
echo "Make sure Ollama is running: ollama serve" 