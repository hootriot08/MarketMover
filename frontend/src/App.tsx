import React, { useState } from 'react'
import './App.css'

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

const App = () => {
  const [ticker, setTicker] = useState('AAPL')
  const [timeframe, setTimeframe] = useState('')
  const [summary, setSummary] = useState('')
  const [headlines, setHeadlines] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [percentChange, setPercentChange] = useState<number | null>(null)
  const [latestClose, setLatestClose] = useState<number | null>(null)
  const [previousClose, setPreviousClose] = useState<number | null>(null)

  const handleSubmit = async () => {
    setLoading(true)
    setSummary('')
    setHeadlines('')
    setPercentChange(null)
    setLatestClose(null)
    setPreviousClose(null)

    try {
      const response = await fetch('http://localhost:3001/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, timeframe }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('API response:', data)
      setSummary(data.summary || '')
      setHeadlines(data.headlines || '')
      setAnalysis(data.analysis || '')
      setPercentChange(data.percentChange ?? null)
      setLatestClose(data.latestClose ?? null)
      setPreviousClose(data.previousClose ?? null)
      setLoading(false)
      setShowResults(true)
    } catch (error) {
      console.error('Error analyzing stock:', error)
      setSummary('Error: Failed to analyze stock. Please try again.')
      setHeadlines('')
      setAnalysis('')
      setPercentChange(null)
      setLatestClose(null)
      setPreviousClose(null)
      setLoading(false)
      setShowResults(true)
    }
  }

  if (showResults) {
    return (
      <div className="app-container">
        <div className="results-page">
          <button onClick={() => setShowResults(false)} className="back-button">← Back</button>
          
          <div className="results-header">
            <img src="/images/trans_logo.png" alt="logo" className="logo" />
            <div className="ticker-header">
              <h1>{ticker}</h1>
              {percentChange !== null && (
                <span 
                  className="percent-change"
                  style={{ 
                    color: percentChange >= 0 ? '#00ff66' : '#ff4444',
                    marginLeft: '10px',
                    fontSize: '1.2em',
                    fontWeight: 'bold'
                  }}
                >
                  {percentChange >= 0 ? '+' : ''}{percentChange}%
                </span>
              )}
            </div>
          </div>
          
          <div className="results-container">
            {percentChange !== null && (
              <div className="result-card">
                <h3>Price Summary</h3>
                <div className="result-content">
                  <p>
                    <strong>Latest Close:</strong> ${latestClose?.toFixed(2)}<br/>
                    <strong>Previous Close:</strong> ${previousClose?.toFixed(2)}<br/>
                    <strong>Change:</strong>{' '}
                    <span style={{ 
                      color: percentChange >= 0 ? '#00ff66' : '#ff4444',
                      fontWeight: 'bold',
                      marginLeft: '5px'
                    }}>
                      {percentChange >= 0 ? '+' : ''}{percentChange}%
                    </span>
                  </p>
                  <p>
                    The price of {ticker} was ${previousClose?.toFixed(2)} {timeframe} ago and is currently ${latestClose?.toFixed(2)}, denoting a {percentChange >= 0 ? '+' : ''}{percentChange}% change.
                  </p>
                </div>
              </div>
            )}
            
            {summary && (
              <div className="result-card">
                <h3>Analysis Summary</h3>
                <div className="result-content">
                  <p>{summary}</p>
                </div>
              </div>
            )}
            
            {analysis && (
              <div className="result-card">
                <h3>AI Analysis</h3>
                <div className="result-content">
                  <p>{analysis}</p>
                </div>
              </div>
            )}
            
            {headlines && (
              <div className="result-card">
                <h3>Recent Headlines</h3>
                <div className="result-content">
                  {headlines.split('\n').map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </div>
              </div>
            )}
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

      <div className="overlay-title">
        <p className="sub-brand">SummariFi Presents</p>
        <div className="brand-row">
          <img src="/images/trans_logo.png" alt="logo" className="logo" />
          <h1>Market Mover</h1>
        </div>
      </div>

      <div id="box1">
        <div className="dropdown-row">
          <div className="input-group">
            <label htmlFor="tickerInput">Ticker Symbol</label>
            <input
              id="tickerInput"
              type="text"
              placeholder="e.g. AAPL"
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
              <option value="" disabled hidden>Select...</option>
              <option>1 day</option>
              <option>3 days</option>
              <option>5 days</option>
              <option>1 week</option>
              <option>2 weeks</option>
              <option>1 month</option>
              <option>3 months</option>
              <option>6 months</option>
              <option>1 year</option>
              <option>5 years</option>
            </select>
          </div>
        </div>

        <div className="button-wrapper">
          <button
            onClick={handleSubmit}
            disabled={loading || !ticker.trim() || !timeframe}
            className="analyze-button"
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
          {loading && (
            <div style={{ marginTop: '10px', fontSize: '0.9rem', color: '#666' }}>
              Fetching data and generating analysis...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
