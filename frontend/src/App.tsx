import React, { useState } from 'react'
import './App.css'
import { motion } from 'framer-motion'

// Enhanced interfaces matching our 100/100 backend
interface StockData {
  startPrice: number
  endPrice: number
  percentChange: number
  startDate: string
  endDate: string
  volumeRatio: number
  marketContext: string
  technicalIndicators: {
    volatility: number
    momentum: number
    volumeSpike: boolean
    priceGap: boolean
  }
}

interface NewsArticle {
  title: string
  source: string
  publishedAt: string
  tags: string[]
  sentiment: number
  relevance: number
}

interface AnalysisResponse {
  ticker: string
  timeframe: string
  drivers: string[]
  llaMAAnalysis: string
  newsArticles: NewsArticle[]
  stockData: StockData
  analysisQuality: {
    newsRelevance: number
    technicalData: string
    confidence: string
  }
  lastUpdated: string
}

function generateBullishPath(k: number) {
  const points: string[] = []
  const steps = 100

  for (let i = 0; i <= steps; i++) {
    const x = (1000 / steps) * i
    const y = 380 * (1 - (Math.exp(k * x) - 1) / (Math.exp(1000 * k) - 1))
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }

  return `M${points.join(' L')}`
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function getConfidenceColor(confidence: string) {
  switch (confidence.toLowerCase()) {
    case 'high': return '#00ff66'
    case 'medium': return '#ffaa00'
    case 'low': return '#ff4444'
    default: return '#666'
  }
}

function getSentimentColor(sentiment: number) {
  if (sentiment > 0.2) return '#00ff66'
  if (sentiment < -0.2) return '#ff4444'
  return '#ffaa00'
}

function getSentimentIcon(sentiment: number) {
  if (sentiment > 0.2) return '📈'
  if (sentiment < -0.2) return '📉'
  return '➡️'
}

const App = () => {
  const [ticker, setTicker] = useState('AAPL')
  const [timeframe, setTimeframe] = useState('1 week')
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [analysisData, setAnalysisData] = useState<AnalysisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    setAnalysisData(null)

    try {
      const response = await fetch('http://localhost:3001/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: ticker.toUpperCase(), timeframe }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('Enhanced API response:', data)
      
      if (data.error) {
        throw new Error(data.error)
      }

      setAnalysisData(data)
      setShowResults(true)
    } catch (error) {
      console.error('Error analyzing stock:', error)
      setError(error instanceof Error ? error.message : 'Failed to analyze stock. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (showResults && analysisData) {
    return (
      <div className="app-container">
        <div className="results-page">
          <button onClick={() => setShowResults(false)} className="back-button">← Back to Analysis</button>
          
          {/* Header Section */}
          <div className="results-header">
            <img src="/images/trans_logo.png" alt="logo" className="logo" />
            <div className="ticker-header">
              <h1>${analysisData.ticker}</h1>
              <div className="ticker-meta">
                <span className="timeframe-badge">{analysisData.timeframe}</span>
                <span 
                  className="percent-change"
                  style={{ 
                    color: analysisData.stockData.percentChange >= 0 ? '#00ff66' : '#ff4444',
                    marginLeft: '10px',
                    fontSize: '1.2em',
                    fontWeight: 'bold'
                  }}
                >
                  {analysisData.stockData.percentChange >= 0 ? '+' : ''}{analysisData.stockData.percentChange}%
                </span>
              </div>
            </div>
          </div>

          {/* Quality Score */}
          <div className="quality-score">
            <div className="quality-badge">
              <span className="quality-icon">🏆</span>
              <span className="quality-text">Analysis Quality: {analysisData.analysisQuality.confidence}</span>
            </div>
            <div className="quality-metrics">
              <span>News Relevance: {analysisData.analysisQuality.newsRelevance}/10</span>
              <span>Technical Data: {analysisData.analysisQuality.technicalData}</span>
            </div>
          </div>
          
          <div className="results-container">
            {/* Stock Data Section */}
            <div className="section-row">
              <div className="result-card stock-data-card">
                <h3><span role="img" aria-label="chart">📊</span> Price Analysis</h3>
                <div className="stock-data-grid">
                  <div className="data-item">
                    <label>Start Price</label>
                    <span className="price">${analysisData.stockData.startPrice.toFixed(2)}</span>
                  </div>
                  <div className="data-item">
                    <label>End Price</label>
                    <span className="price">${analysisData.stockData.endPrice.toFixed(2)}</span>
                  </div>
                  <div className="data-item">
                    <label>Volume Ratio</label>
                    <span className={analysisData.stockData.volumeRatio > 1.5 ? 'volume-spike' : 'volume-normal'}>
                      {analysisData.stockData.volumeRatio.toFixed(2)}x
                    </span>
                  </div>
                  <div className="data-item">
                    <label>Market Context</label>
                    <span className="market-context">{analysisData.stockData.marketContext}</span>
                  </div>
                </div>
              </div>

              <div className="result-card technical-card">
                <h3><span role="img" aria-label="technical">⚡</span> Technical Indicators</h3>
                <div className="technical-grid">
                  <div className="tech-item">
                    <label>Volatility</label>
                    <span className={analysisData.stockData.technicalIndicators.volatility > 0.02 ? 'high-volatility' : 'normal-volatility'}>
                      {(analysisData.stockData.technicalIndicators.volatility * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="tech-item">
                    <label>Momentum</label>
                    <span className={analysisData.stockData.technicalIndicators.momentum > 0 ? 'positive-momentum' : 'negative-momentum'}>
                      {(analysisData.stockData.technicalIndicators.momentum * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="tech-item">
                    <label>Volume Spike</label>
                    <span className={analysisData.stockData.technicalIndicators.volumeSpike ? 'spike-detected' : 'no-spike'}>
                      {analysisData.stockData.technicalIndicators.volumeSpike ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="tech-item">
                    <label>Price Gap</label>
                    <span className={analysisData.stockData.technicalIndicators.priceGap ? 'gap-detected' : 'no-gap'}>
                      {analysisData.stockData.technicalIndicators.priceGap ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Analysis Section */}
            <div className="section-row">
              <div className="result-card ai-analysis-card">
                <h3><span role="img" aria-label="ai">🤖</span> AI-Powered Price Drivers</h3>
                <div className="drivers-list">
                  {analysisData.drivers.map((driver, index) => (
                    <div key={index} className="driver-item">
                      <div className="driver-number">{index + 1}</div>
                      <div className="driver-content">
                        <div className="driver-text">{driver}</div>
                        <div className="driver-confidence">
                          <span 
                            className="confidence-badge"
                            style={{ backgroundColor: getConfidenceColor(driver.includes('High') ? 'High' : driver.includes('Medium') ? 'Medium' : 'Low') }}
                          >
                            {driver.includes('High') ? 'High' : driver.includes('Medium') ? 'Medium' : 'Low'} Confidence
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* News Analysis Section */}
            <div className="section-row">
              <div className="result-card news-card">
                <h3><span role="img" aria-label="news">📰</span> Relevant News Analysis</h3>
                <div className="news-grid">
                  {analysisData.newsArticles.slice(0, 8).map((article, index) => (
                    <div key={index} className="news-item">
                      <div className="news-header">
                        <span className="news-source">{article.source}</span>
                        <span className="news-time">{formatTime(article.publishedAt)}</span>
                      </div>
                      <div className="news-title">{article.title}</div>
                      <div className="news-meta">
                        <div className="news-tags">
                          {article.tags.slice(0, 2).map((tag, tagIndex) => (
                            <span key={tagIndex} className="news-tag">{tag}</span>
                          ))}
                        </div>
                        <div className="news-sentiment">
                          <span className="sentiment-icon">{getSentimentIcon(article.sentiment)}</span>
                          <span 
                            className="sentiment-score"
                            style={{ color: getSentimentColor(article.sentiment) }}
                          >
                            {article.sentiment > 0 ? '+' : ''}{article.sentiment.toFixed(1)}
                          </span>
                        </div>
                        <div className="news-relevance">
                          <span className="relevance-score">Relevance: {article.relevance}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="analysis-footer">
              <div className="footer-info">
                <span>Last Updated: {formatTime(analysisData.lastUpdated)}</span>
                <span>Powered by LLaMA 3 AI</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <svg className="stock-line" viewBox="0 0 1000 400" preserveAspectRatio="none">
        <path id="expPath" d={generateBullishPath(0.00594)} className="glow-line" />
        <polyline
          points="
            0,380 
            100,340 
            200,360 
            300,310 
            400,330 
            500,250 
            600,270 
            700,200 
            800,230 
            900,120 
            1000,0"
          className="jagged-line"
        />
        <circle r="6" fill="#00ff66">
          <animateMotion repeatCount="indefinite" dur="2.5s">
            <mpath href="#expPath" />
          </animateMotion>
        </circle>
      </svg>

      <motion.div
        className="overlay-title"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <p className="sub-brand">SummariFi Presents</p>
        <div className="brand-row">
          <img src="/images/trans_logo.png" alt="logo" className="logo" />
          <h1>Market Mover</h1>
        </div>
        <p className="tagline">AI-Powered Financial Analysis with 100/100 Quality</p>
      </motion.div>

      <motion.div
        id="box1"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="dropdown-row">
          <div className="input-group">
            <label htmlFor="tickerInput">Ticker Symbol</label>
            <input
              id="tickerInput"
              type="text"
              placeholder="e.g. AAPL, NVDA, TSLA"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
            />
          </div>

          <div className="input-group">
            <label htmlFor="timeframeMenu">Timeframe</label>
            <select
              id="timeframeMenu"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
            >
              <option value="1 day">1 day</option>
              <option value="3 days">3 days</option>
              <option value="5 days">5 days</option>
              <option value="1 week">1 week</option>
              <option value="2 weeks">2 weeks</option>
              <option value="1 month">1 month</option>
              <option value="3 months">3 months</option>
              <option value="6 months">6 months</option>
              <option value="1 year">1 year</option>
              <option value="5 years">5 years</option>
            </select>
          </div>
        </div>

        <div className="button-wrapper">
          <button
            onClick={handleSubmit}
            disabled={loading || !ticker.trim()}
            className="analyze-button"
          >
            {loading ? '🤖 AI Analyzing...' : '🚀 Analyze with AI'}
          </button>
          {loading && (
            <div className="loading-info">
              <div>📊 Fetching market data...</div>
              <div>📰 Processing news articles...</div>
              <div>🤖 Generating AI analysis...</div>
            </div>
          )}
          {error && (
            <div className="error-message">
              ❌ {error}
            </div>
          )}
        </div>

        <div className="features-preview">
          <div className="feature-item">
            <span className="feature-icon">🤖</span>
            <span>LLaMA 3 AI Analysis</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">📊</span>
            <span>Technical Indicators</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">📰</span>
            <span>Smart News Filtering</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🎯</span>
            <span>Confidence Scoring</span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default App