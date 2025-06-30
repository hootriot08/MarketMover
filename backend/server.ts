import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import type { Request, Response } from 'express'
import axios from 'axios'
import yahooFinance from 'yahoo-finance2'
import { Ollama } from 'ollama'
const { Readability } = require('node-readability')

const app = express()
const port = 3001

app.use(cors())
app.use(bodyParser.json())

// Initialize Ollama client
const ollama = new Ollama({
  host: 'http://localhost:11434'
})

// Enhanced stock data interface with technical analysis
interface StockData {
  ticker: string
  startPrice: number
  endPrice: number
  percentChange: number
  startDate: string
  endDate: string
  averageVolume: number
  actualVolume: number
  volumeRatio: number
  priceHistory: Array<{
    date: string
    close: number
    volume: number
  }>
  technicalIndicators: {
    volatility: number
    momentum: number
    volumeSpike: boolean
    priceGap: boolean
  }
}

// Enhanced driver interface with confidence
interface Driver {
  category: string
  explanation: string
  confidence: number
  evidence: string[]
  impact: 'high' | 'medium' | 'low'
}

// News article interface
interface NewsArticle {
  title: string
  description: string
  url: string
  publishedAt: string
  source: string
  sentiment?: number
  tags?: string[]
  relevance: number
}

// Enhanced function to get comprehensive stock data
async function getEnhancedStockData(ticker: string, timeframe: string): Promise<StockData | null> {
  try {
    // Convert timeframe to days
    const timeframeMap: Record<string, number> = {
      '1 day': 1,
      '3 days': 3,
      '5 days': 5,
      '1 week': 7,
      '2 weeks': 14,
      '1 month': 30,
      '3 months': 90,
      '6 months': 180,
      '1 year': 365,
      '5 years': 1825
    }
    
    const days = timeframeMap[timeframe] || 7
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - days)

    console.log(`📊 Fetching data for ${ticker} over ${timeframe} (${days} days)`)

    // Fetch historical data using yahoo-finance2
    const results = await yahooFinance.historical(ticker, {
      period1: startDate,
      period2: endDate,
      interval: '1d',
    })

    if (!results || results.length < 2) {
      console.log(`❌ Insufficient data points for ${ticker}: ${results?.length || 0} points`)
      return null
    }

    console.log(`✅ Got ${results.length} data points for ${ticker}`)

    // Calculate volume metrics
    const volumes = results.map(r => r.volume || 0).filter(v => v > 0)
    const averageVolume = volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 0
    const actualVolume = results[results.length - 1].volume || 0
    const volumeRatio = averageVolume > 0 ? actualVolume / averageVolume : 1

    // Data is sorted oldest first
    const startPrice = results[0].close
    const endPrice = results[results.length - 1].close
    const startDateStr = results[0].date ? new Date(results[0].date).toISOString() : ''
    const endDateStr = results[results.length - 1].date ? new Date(results[results.length - 1].date).toISOString() : ''
    const percentChange = ((endPrice - startPrice) / startPrice) * 100

    const priceHistory = results.map(r => ({
      date: r.date ? new Date(r.date).toISOString() : '',
      close: r.close,
      volume: r.volume || 0
    }))

    console.log(`📈 ${ticker}: $${startPrice.toFixed(2)} → $${endPrice.toFixed(2)} (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(2)}%)`)

    // Calculate technical indicators
    const prices = results.map(r => r.close)
    const returns = prices.slice(1).map((price, i) => (price - prices[i]) / prices[i])
    const volatility = returns.length > 0 ? Math.sqrt(returns.reduce((sum, ret) => sum + ret * ret, 0) / returns.length) : 0
    const momentum = returns.length > 0 ? returns.reduce((sum, ret) => sum + ret, 0) : 0
    const volumeSpike = volumeRatio > 1.5
    const priceGap = Math.abs(percentChange) > 5

    return {
      ticker,
      startPrice,
      endPrice,
      percentChange: parseFloat(percentChange.toFixed(2)),
      startDate: startDateStr,
      endDate: endDateStr,
      averageVolume,
      actualVolume,
      volumeRatio,
      priceHistory,
      technicalIndicators: {
        volatility: parseFloat(volatility.toFixed(4)),
        momentum: parseFloat(momentum.toFixed(4)),
        volumeSpike,
        priceGap
      }
    }
  } catch (error) {
    console.error(`❌ Error fetching stock data for ${ticker}:`, error)
    return null
  }
}

// Enhanced news fetching with sentiment analysis
async function getEnhancedNews(ticker: string, startDate: string, endDate: string): Promise<NewsArticle[]> {
  try {
    // Fetch news articles from NewsAPI with better query
    const query = `${ticker} AND (stock OR earnings OR revenue OR analyst OR upgrade OR downgrade OR price OR target OR financial OR quarterly)`
    const newsUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&language=en&pageSize=30&from=${startDate}&to=${endDate}&apiKey=9f918bb0ea034b5e81b4fbcea7da5429`
    
    const response = await axios.get(newsUrl)
    const articles = (response.data as any).articles || []

    console.log(`📰 Found ${articles.length} news articles for ${ticker}`)

    // Process and tag articles with enhanced relevance scoring
    const processedArticles: NewsArticle[] = articles.map((article: any) => {
      const title = article.title || ''
      const description = article.description || ''
      
      // Improved sentiment analysis and tagging
      const text = `${title} ${description}`.toLowerCase()
      let sentiment = 0
      const tags: string[] = []
      let relevance = 0

      // More nuanced sentiment analysis
      const positiveKeywords = ['upgrade', 'bullish', 'positive', 'beat', 'higher', 'rise', 'gain', 'surge', 'rally', 'strong', 'growth', 'profit', 'buy', 'outperform']
      const negativeKeywords = ['downgrade', 'bearish', 'negative', 'miss', 'lower', 'fall', 'drop', 'decline', 'weak', 'loss', 'concern', 'risk', 'sell', 'underperform']
      
      // Count positive and negative keywords
      const positiveCount = positiveKeywords.filter(word => text.includes(word)).length
      const negativeCount = negativeKeywords.filter(word => text.includes(word)).length
      
      // Calculate sentiment score
      if (positiveCount > negativeCount) {
        sentiment = Math.min(0.5, (positiveCount - negativeCount) * 0.2)
      } else if (negativeCount > positiveCount) {
        sentiment = Math.max(-0.5, (negativeCount - positiveCount) * -0.2)
      }

      // Enhanced tagging logic with relevance scoring
      if (text.includes('upgrade') || text.includes('bullish') || text.includes('buy') || text.includes('outperform')) {
        tags.push('Analyst Upgrade')
        sentiment = Math.max(sentiment, 0.3)
        relevance += 3
      }
      if (text.includes('downgrade') || text.includes('bearish') || text.includes('sell') || text.includes('underperform')) {
        tags.push('Analyst Downgrade')
        sentiment = Math.min(sentiment, -0.3)
        relevance += 3
      }
      if (text.includes('earnings') || text.includes('quarterly') || text.includes('results') || text.includes('q1') || text.includes('q2') || text.includes('q3') || text.includes('q4')) {
        tags.push('Earnings')
        relevance += 4
      }
      if (text.includes('revenue') || text.includes('sales') || text.includes('financial') || text.includes('guidance')) {
        tags.push('Revenue')
        relevance += 3
      }
      if (text.includes('ai') || text.includes('artificial intelligence') || text.includes('technology') || text.includes('innovation')) {
        tags.push('AI/Tech')
        relevance += 2
      }
      if (text.includes('fed') || text.includes('interest rate') || text.includes('inflation') || text.includes('economy') || text.includes('macro')) {
        tags.push('Macro')
        relevance += 2
      }
      if (text.includes('price target') || text.includes('target price') || text.includes('pt')) {
        tags.push('Price Target')
        relevance += 3
      }
      if (text.includes('volume') || text.includes('trading') || text.includes('technical')) {
        tags.push('Trading')
        relevance += 1
      }
      if (text.includes('partnership') || text.includes('acquisition') || text.includes('merger') || text.includes('deal')) {
        tags.push('Corporate Action')
        relevance += 3
      }

      // Boost relevance for high-quality sources
      const qualitySources = ['bloomberg', 'reuters', 'cnbc', 'marketwatch', 'yahoo finance', 'seeking alpha']
      if (qualitySources.some(source => article.source?.name?.toLowerCase().includes(source))) {
        relevance += 2
      }

      // Penalize irrelevant articles
      if (text.includes('lawsuit') || text.includes('legal') || text.includes('court')) {
        relevance -= 1
      }

      return {
        title: article.title,
        description: article.description,
        url: article.url,
        publishedAt: article.publishedAt,
        source: article.source?.name || 'Unknown',
        sentiment,
        tags,
        relevance: Math.max(0, relevance)
      }
    })

    // Sort by relevance and recency
    processedArticles.sort((a, b) => {
      // Prioritize articles with high relevance and sentiment magnitude
      const aScore = a.relevance + Math.abs(a.sentiment || 0) * 2
      const bScore = b.relevance + Math.abs(b.sentiment || 0) * 2
      if (aScore !== bScore) return bScore - aScore
      
      // Then by recency
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    })

    // Filter out low-relevance articles
    const filteredArticles = processedArticles.filter(article => article.relevance > 0)

    console.log(`🏷️ Processed ${filteredArticles.length} high-relevance articles with tags and sentiment`)

    return filteredArticles.slice(0, 15) // Return top 15 most relevant
  } catch (error) {
    console.error('❌ Error fetching news:', error)
    return []
  }
}

// Generate enhanced LLaMA 3 prompt for financial analysis
function generateLLaMAPrompt(stockData: StockData, newsArticles: NewsArticle[], timeframe: string): string {
  const startDate = new Date(stockData.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  const endDate = new Date(stockData.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  const priceChange = `${stockData.percentChange > 0 ? '+' : ''}${stockData.percentChange}%`
  const volumeContext = stockData.volumeRatio > 1.5 ? `(Volume spike: ${stockData.volumeRatio.toFixed(1)}x average)` : 
                       stockData.volumeRatio < 0.7 ? `(Low volume: ${stockData.volumeRatio.toFixed(1)}x average)` : ''
  
  const technicalContext = stockData.technicalIndicators.volatility > 0.02 ? `(High volatility: ${(stockData.technicalIndicators.volatility * 100).toFixed(1)}%)` : ''
  const gapContext = stockData.technicalIndicators.priceGap ? ' (Significant price gap detected)' : ''

  // Format news headlines with enhanced metadata
  const headlinesSection = newsArticles.length > 0 
    ? newsArticles.map((article, i) => {
        const tags = article.tags?.length ? ` [${article.tags.join(', ')}]` : ''
        const sentiment = article.sentiment ? ` (${article.sentiment > 0 ? '+' : ''}${article.sentiment.toFixed(1)})` : ''
        const relevance = ` [Relevance: ${article.relevance}]`
        return `${i + 1}. ${article.title}${tags}${sentiment}${relevance}`
      }).join('\n')
    : 'No relevant news articles found.'

  return `You are a senior financial analyst at a top-tier investment bank. Your task is to provide a professional, evidence-based analysis of stock price movements.

STOCK ANALYSIS REQUEST:
Ticker: $${stockData.ticker}
Timeframe: ${timeframe}
Date Range: ${startDate} to ${endDate}
Price Movement: $${stockData.startPrice.toFixed(2)} → $${stockData.endPrice.toFixed(2)} (${priceChange}) ${volumeContext} ${technicalContext} ${gapContext}

TECHNICAL CONTEXT:
- Volatility: ${(stockData.technicalIndicators.volatility * 100).toFixed(2)}%
- Momentum: ${(stockData.technicalIndicators.momentum * 100).toFixed(2)}%
- Volume Pattern: ${stockData.technicalIndicators.volumeSpike ? 'Unusual spike' : 'Normal'}
- Price Gap: ${stockData.technicalIndicators.priceGap ? 'Yes' : 'No'}

RELEVANT NEWS (${newsArticles.length} articles, sorted by relevance):
${headlinesSection}

ANALYSIS REQUIREMENTS:
1. Identify exactly 2-3 drivers that most likely caused this price movement
2. Each driver must be supported by specific evidence from the news articles
3. Consider the magnitude and direction of the price change
4. Account for technical indicators (volume, volatility, momentum)
5. Avoid contradictory explanations
6. Be specific and actionable

DRIVER CATEGORIES (with confidence levels):
- Analyst Actions (upgrades/downgrades, price targets) - High confidence
- Earnings/Financial News (results, guidance, revenue) - High confidence  
- Macro Factors (Fed policy, economic data) - Medium confidence
- Sector Rotation (money flow between sectors) - Medium confidence
- Company-Specific News (product launches, partnerships) - High confidence
- Technical Factors (volume spikes, technical levels) - Medium confidence

OUTPUT FORMAT:
Provide exactly 2-3 drivers in this format:

1. [Driver Category] — [Specific explanation with evidence from news articles] (Confidence: High/Medium/Low)
2. [Driver Category] — [Specific explanation with evidence from news articles] (Confidence: High/Medium/Low)
3. [Driver Category] — [Specific explanation with evidence from news articles] (Confidence: High/Medium/Low)

Be specific, evidence-based, and professional. If the news doesn't clearly support a driver, don't include it. Focus on the most impactful factors for this specific timeframe.`
}

// Call LLaMA 3 for analysis
async function getLLaMAAnalysis(prompt: string): Promise<string> {
  try {
    const response = await ollama.chat({
      model: 'llama3',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      options: {
        temperature: 0.3,
        top_p: 0.9
      }
    })

    return response.message.content || 'Unable to generate analysis.'
  } catch (error) {
    console.error('❌ LLaMA API error:', error)
    return 'LLaMA analysis unavailable. Please check if Ollama is running with llama3 model.'
  }
}

// Main analysis endpoint
app.post('/analyze', async (req: Request, res: Response): Promise<void> => {
  const { ticker, timeframe } = req.body

  console.log('➡️ Incoming request:', { ticker, timeframe })

  if (!ticker || !timeframe) {
    console.log('⛔ Missing ticker or timeframe')
    res.status(400).json({
      error: 'Missing ticker or timeframe',
      drivers: [],
      newsArticles: [],
      stockData: null
    })
    return
  }

  try {
    // Get enhanced stock data
    const stockData = await getEnhancedStockData(ticker, timeframe)
    
    if (!stockData) {
      console.log('❌ No stock data available for', ticker)
      res.json({
        error: `Unable to analyze ${ticker} - insufficient price data available for ${timeframe}.`,
        drivers: [],
        newsArticles: [],
        stockData: null
      })
      return
    }

    // Get S&P 500 context
    const sp500Data = await getEnhancedStockData('SPY', timeframe)
    let marketContext = ''
    if (sp500Data) {
      const spDir = sp500Data.percentChange > 0 ? 'up' : (sp500Data.percentChange < 0 ? 'down' : 'flat')
      marketContext = `Market context: S&P 500 moved ${spDir} by ${sp500Data.percentChange > 0 ? '+' : ''}${sp500Data.percentChange}% during the same period.`
    }

    // Get enhanced news articles
    const newsArticles = await getEnhancedNews(ticker, stockData.startDate, stockData.endDate)

    // Generate LLaMA prompt
    const prompt = generateLLaMAPrompt(stockData, newsArticles, timeframe)

    // Get LLaMA analysis
    const llaMAAnalysis = await getLLaMAAnalysis(prompt)

    // Parse drivers from LLaMA response
    const drivers = llaMAAnalysis
      .split('\n')
      .filter(line => /^\d+\./.test(line.trim()))
      .map(line => line.trim().replace(/^\d+\.\s*/, ''))
      .filter(driver => driver.length > 0)

    res.json({
      ticker: stockData.ticker,
      timeframe,
      drivers,
      llaMAAnalysis,
      newsArticles: newsArticles.map(article => ({
        title: article.title,
        source: article.source,
        publishedAt: article.publishedAt,
        tags: article.tags,
        sentiment: article.sentiment,
        relevance: article.relevance
      })),
      stockData: {
        startPrice: stockData.startPrice,
        endPrice: stockData.endPrice,
        percentChange: stockData.percentChange,
        startDate: stockData.startDate,
        endDate: stockData.endDate,
        volumeRatio: stockData.volumeRatio,
        marketContext,
        technicalIndicators: {
          volatility: stockData.technicalIndicators.volatility,
          momentum: stockData.technicalIndicators.momentum,
          volumeSpike: stockData.technicalIndicators.volumeSpike,
          priceGap: stockData.technicalIndicators.priceGap
        }
      },
      analysisQuality: {
        newsRelevance: newsArticles.length > 0 ? Math.round(newsArticles.reduce((sum, a) => sum + a.relevance, 0) / newsArticles.length) : 0,
        technicalData: stockData.technicalIndicators.volatility > 0 ? 'Complete' : 'Limited',
        confidence: drivers.length >= 2 ? 'High' : 'Medium'
      },
      lastUpdated: new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false })
    })

  } catch (error) {
    console.error('❌ Analysis error:', error)
    res.status(500).json({
      error: 'Analysis failed. Please try again.',
      drivers: [],
      newsArticles: [],
      stockData: null
    })
  }
})

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`)
  console.log('📊 Enhanced financial analysis with LLaMA 3 integration ready!')
})