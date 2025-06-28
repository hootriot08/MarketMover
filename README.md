# MarketMover

A real-time stock analysis tool that provides AI-powered insights on stock movements with news headlines and price analysis.

## Features

- **Real-time Stock Data**: Get current and historical stock prices using Yahoo Finance API
- **AI Analysis**: Powered by Ollama LLM for intelligent market insights
- **News Integration**: Latest headlines from NewsAPI
- **Beautiful UI**: Modern React frontend with animated stock charts
- **Multiple Timeframes**: Analyze stocks over various periods (1 day to 5 years)

## Project Structure

```
marketmover/
├── backend/          # Express.js API server
├── frontend/         # React + Vite frontend
└── README.md
```

## Setup

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

- `POST /analyze` - Analyze stock with ticker and timeframe
  - Body: `{ "ticker": "AAPL", "timeframe": "1 week" }`
  - Returns: Price data, news headlines, and AI analysis

## Technologies

- **Backend**: Node.js, Express, TypeScript, Yahoo Finance API, Ollama
- **Frontend**: React, TypeScript, Vite, CSS3
- **APIs**: Yahoo Finance, NewsAPI, Ollama LLM

## Environment Variables

Make sure to set up your NewsAPI key in the backend server. 