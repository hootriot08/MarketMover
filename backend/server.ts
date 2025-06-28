import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import type { Request, Response } from 'express'
import axios from 'axios'
import yahooFinance from 'yahoo-finance2'
import ollama from 'ollama'
const { Readability } = require('node-readability')

const app = express()
const port = 3001

app.use(cors())
app.use(bodyParser.json())

// Helper function to get stock prices and calculate percent change
async function getStockPriceChange(ticker: string, timeframe: string): Promise<{
  percentChange: number;
  latestClose: number;
  previousClose: number;
  previousDate: string;
  latestDate: string;
} | null> {
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
    const previousDate = results[0].date ? new Date(results[0].date).toISOString() : '';
    const latestDate = results[results.length - 1].date ? new Date(results[results.length - 1].date).toISOString() : '';
    const percentChange = ((latestClose - previousClose) / previousClose) * 100;

    return {
      percentChange: parseFloat(percentChange.toFixed(2)),
      latestClose,
      previousClose,
      previousDate,
      latestDate
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
      analysisBullets: [],
      macroBullets: [],
      noImpactBullets: [],
      aiSummary: '',
      rawAi: '',
      headlines: '',
      percentChange: null,
      error: 'Missing ticker or timeframe'
    })
    return
  }

  try {
    // Get stock price change
    const priceData = await getStockPriceChange(ticker, timeframe)
    // Get S&P 500 price change
    const sp500Data = await getStockPriceChange('SPY', timeframe)
    let sp500Context = ''
    if (sp500Data) {
      const spDir = sp500Data.percentChange > 0 ? 'up' : (sp500Data.percentChange < 0 ? 'down' : 'flat')
      sp500Context = `During the same period, the S&P 500 moved ${spDir} by ${sp500Data.percentChange > 0 ? '+' : ''}${sp500Data.percentChange}%.`
    }

    // If no price data available, return early with error
    if (!priceData) {
      console.log('❌ No price data available for', ticker)
      res.json({
        summary: `Unable to analyze ${ticker} - insufficient price data available for ${timeframe}.`,
        analysis: '',
        analysisBullets: ['Insufficient price data available for analysis.'],
        macroBullets: [],
        noImpactBullets: [],
        financialBullets: [],
        managementBullets: [],
        institutionalBullets: [],
        aiSummary: '',
        rawAi: '',
        lastUpdated: new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false }),
        headlines: 'No recent headlines found.',
        percentChange: null,
        latestClose: null,
        previousClose: null,
        previousDate: null,
        latestDate: null
      })
      return
    }

    // Fetch news articles
    const query = `${ticker} AND stock AND (up OR down)`
    const newsUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&language=en&pageSize=5&apiKey=9f918bb0ea034b5e81b4fbcea7da5429`
    const response = await axios.get(newsUrl)
    const articles = (response.data as any).articles || []

    // Sort articles by publish date (most recent first)
    articles.sort((a: any, b: any) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    // Get current timestamp
    const lastUpdated = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false });

    // Try to extract full article text for each article (skip paywalled/unparsable)
    async function extractArticleText(url: string): Promise<string | null> {
      try {
        return await new Promise((resolve) => {
          Readability(url, (err: any, article: any) => {
            if (err || !article) return resolve(null)
            const text = article.content || article.textBody || ''
            article.close && article.close()
            resolve(text.trim())
          })
        })
      } catch (e) {
        return null
      }
    }

    let fullArticles: string[] = []
    for (const art of articles) {
      if (art.url) {
        const text = await extractArticleText(art.url)
        if (text && text.length > 200 && !/paywall|subscribe|sign in/i.test(text)) {
          fullArticles.push(text)
        } else {
          fullArticles.push(art.title)
        }
      } else {
        fullArticles.push(art.title)
      }
    }

    // Build LLM prompt (Bloomberg/Cursor style, strict JSON)
    const startDate = priceData?.previousDate ? new Date(priceData.previousDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '(unknown)';
    const endDate = priceData?.latestDate ? new Date(priceData.latestDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '(unknown)';
    const priceChange = priceData ? `${priceData.percentChange > 0 ? '+' : ''}${priceData.percentChange}%` : 'N/A';
    const sp500Change = sp500Data ? `${sp500Data.percentChange > 0 ? '+' : ''}${sp500Data.percentChange}%` : 'N/A';
    const articleSection = fullArticles.length > 0 ? fullArticles.map((txt, i) => `Article ${i + 1} (Published: ${articles[i]?.publishedAt || 'unknown'}):\n${txt}`).join('\n\n') : 'No recent news articles found.';

    const basePrompt = `You are a financial assistant.\n\nYour job is to explain a stock's price movement based on the news and macroeconomic context provided.\n\nReturn your response in two sections, each as a bullet point list:\n\n- **Company Summary**: Bullet points (not long sentences) explaining the 1–3 most relevant company-specific news or events that likely explain the stock's price movement. Each bullet should be a single, clear idea.\n- **Macro Summary**: Bullet points (not long sentences) explaining any broader market or macroeconomic factors that may have influenced the stock or sentiment. If nothing relevant, just write: \`None observed.\`\n\nGuidelines:\n- Use bullet points (•) for each section.\n- Do not include irrelevant or generic news.\n- Do not write any introductory or summary sentences.\n- Make the output feel like something a junior analyst would send to a trader.\n\nStock: ${ticker}\nDate range: ${startDate} to ${endDate}\nPrice change: ${priceChange}\nS&P 500 change: ${sp500Change}\n\nNews articles:\n${articleSection}\n\nOutput ONLY the two bullet point sections above. No preamble, no follow-up explanation.`;

    // --- Ollama LLM integration for AI analysis ---
    let companySummary = ''
    let macroSummary = ''
    let signalBullets: string[] = []
    let raw = ''
    let triedForceful = false;
    async function getLLMOutput(prompt: string): Promise<{companySummary: string, macroSummary: string, raw: string}> {
      const ollamaResponse = await ollama.chat({
        model: 'llama3',
        messages: [{ role: 'user', content: prompt }]
      })
      const raw = ollamaResponse.message.content.trim()
      
      // Extract company-relevant news section
      let companySummary = ''
      const companyMatch = raw.match(/•\s*\*\*Company-Relevant News\*\*:\s*([\s\S]*?)(?=\n•\s*\*\*Macroeconomic Factors\*\*:|$)/)
      if (companyMatch) {
        companySummary = companyMatch[1].trim()
      }
      
      // Extract macroeconomic factors section
      let macroSummary = ''
      const macroMatch = raw.match(/•\s*\*\*Macroeconomic Factors\*\*:\s*([\s\S]*?)(?=\n|$)/)
      if (macroMatch) {
        macroSummary = macroMatch[1].trim()
      }
      
      return { companySummary, macroSummary, raw }
    }
    // Try once with base prompt
    let llmResult = await getLLMOutput(basePrompt)
    // If missing, try again with a more forceful prompt
    if ((!llmResult.companySummary || !llmResult.macroSummary) && !triedForceful) {
      triedForceful = true;
      const forcefulPrompt = basePrompt + '\n\nIMPORTANT: Ensure your response follows the exact format specified above with the 📊 AI Analysis section containing both Company-Relevant News and Macroeconomic Factors subsections.'
      llmResult = await getLLMOutput(forcefulPrompt)
    }
    companySummary = llmResult.companySummary
    macroSummary = llmResult.macroSummary
    raw = llmResult.raw
    
    // Fallback: if still missing, use the raw output as company summary
    if (!companySummary && raw) {
      companySummary = raw
    }
    // --- End Ollama integration ---

    const headlinesArray = articles.map((article: any) => `• ${article.title}`)
    const formattedHeadlines = headlinesArray.join('\n')

    // Combine all analysis bullets for frontend display
    let allAnalysisBullets: string[] = []
    // Add confidence level at the top if available
    // if (signalBullets.length > 0) {
    //   allAnalysisBullets.push('**Signal Bullets:**')
    //   allAnalysisBullets.push(...signalBullets)
    // }
    // Add summary if available
    // if (signalBullets.length > 0) {
    //   allAnalysisBullets.push('**Summary:**')
    //   allAnalysisBullets.push(signalBullets[0])
    // }

    res.json({
      summary: `Here's a quick summary of ${ticker} over ${timeframe}.`,
      // signalBullets, // REMOVE from response
      companySummary,
      macroSummary,
      analysis: '',
      analysisBullets: allAnalysisBullets,
      macroBullets: [],
      noImpactBullets: [],
      financialBullets: [],
      managementBullets: [],
      institutionalBullets: [],
      aiSummary: '',
      confidenceLevel: '',
      missingContext: '',
      priceSentimentContrast: '',
      rawAi: raw,
      lastUpdated,
      headlines: formattedHeadlines || 'No recent headlines found.',
      percentChange: priceData?.percentChange || null,
      latestClose: priceData?.latestClose || null,
      previousClose: priceData?.previousClose || null,
      previousDate: priceData?.previousDate || null,
      latestDate: priceData?.latestDate || null
    })
  } catch (err) {
    console.error('❌ NewsAPI error:', err)
    res.status(500).json({
      summary: '',
      analysis: '',
      analysisBullets: [],
      macroBullets: [],
      noImpactBullets: [],
      aiSummary: '',
      rawAi: '',
      headlines: '',
      percentChange: null,
      error: 'NewsAPI request failed.'
    })
  }
})

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`)
})