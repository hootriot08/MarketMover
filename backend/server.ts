import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import type { Request, Response } from 'express'
import axios from 'axios'
import yahooFinance from 'yahoo-finance2'
import ollama from 'ollama'

const app = express()
const port = 3001

app.use(cors())
app.use(bodyParser.json())

// Helper function to get stock prices and calculate percent change
async function getStockPriceChange(ticker: string, timeframe: string): Promise<{ percentChange: number; latestClose: number; previousClose: number } | null> {
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
    };
    const days = timeframeMap[timeframe] || 1;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    // Fetch historical data using yahoo-finance2
    const results = await yahooFinance.historical(ticker, {
      period1: startDate,
      period2: endDate,
      interval: '1d',
    });

    if (!results || results.length < 2) {
      console.log('❌ Insufficient data points');
      return null;
    }

    // Data is sorted oldest first
    const previousClose = results[0].close;
    const latestClose = results[results.length - 1].close;
    const percentChange = ((latestClose - previousClose) / previousClose) * 100;

    return {
      percentChange: parseFloat(percentChange.toFixed(2)),
      latestClose,
      previousClose
    };
  } catch (error) {
    console.error('❌ Error fetching stock data:', error);
    return null;
  }
}

app.post('/analyze', async (req: Request, res: Response): Promise<void> => {
  const { ticker, timeframe } = req.body

  console.log('➡️ Incoming request:', { ticker, timeframe })

  if (!ticker || !timeframe) {
    console.log('⛔ Missing ticker or timeframe')
    res.status(400).json({
      summary: '',
      analysis: '',
      headlines: '',
      percentChange: null,
      error: 'Missing ticker or timeframe'
    })
    return
  }

  try {
    // Get stock price change
    const priceData = await getStockPriceChange(ticker, timeframe)
    
    const summary = `Here's a quick summary of ${ticker} over ${timeframe}.`

    // Construct a strict NewsAPI query: must include the ticker, "stock", and either "up" or "down"
    const query = `${ticker} AND stock AND (up OR down)`
    const newsUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&language=en&pageSize=5&apiKey=9f918bb0ea034b5e81b4fbcea7da5429`
    console.log('🌐 Fetching headlines from:', newsUrl)

    const response = await axios.get(newsUrl)
    console.log('✅ NewsAPI response received')

    const articles = (response.data as any).articles || []
    console.log(`📰 Found ${articles.length} articles`)

    const headlinesArray = articles.map((article: any) => `• ${article.title}`)
    console.log('🧾 Headlines Array:', headlinesArray)

    const formattedHeadlines = headlinesArray.join('\n')
    console.log('📦 Final formatted headlines:', formattedHeadlines)

    // --- Ollama LLM integration for AI analysis ---
    let analysis = ''
    try {
      const direction = priceData && priceData.percentChange !== 0 ? (priceData.percentChange > 0 ? 'up' : 'down') : 'flat'
      const ollamaPrompt = `Given these news headlines and the price change, why did ${ticker} move ${direction} over the last ${timeframe}?\n\nHeadlines:\n${formattedHeadlines}\n\nPrice Change: ${priceData ? priceData.percentChange + '%' : 'N/A'}`
      const ollamaResponse = await ollama.chat({
        model: 'llama3',
        messages: [{ role: 'user', content: ollamaPrompt }]
      })
      analysis = ollamaResponse.message.content.trim()
    } catch (ollamaErr) {
      console.error('❌ Ollama error:', ollamaErr)
      analysis = 'AI analysis unavailable.'
    }
    // --- End Ollama integration ---

    res.json({
      summary,
      analysis,
      headlines: formattedHeadlines || 'No recent headlines found.',
      percentChange: priceData?.percentChange || null,
      latestClose: priceData?.latestClose || null,
      previousClose: priceData?.previousClose || null
    })
  } catch (err) {
    console.error('❌ NewsAPI error:', err)
    res.status(500).json({
      summary: '',
      analysis: '',
      headlines: '',
      percentChange: null,
      error: 'NewsAPI request failed.'
    })
  }
})

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`)
})