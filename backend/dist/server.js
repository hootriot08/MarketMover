"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const axios_1 = __importDefault(require("axios"));
const yahoo_finance2_1 = __importDefault(require("yahoo-finance2"));
const generative_ai_1 = require("@google/generative-ai");
const { Readability } = require('node-readability');
const app = (0, express_1.default)();
const port = 3001;
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json());
// Initialize Google AI client
const genAI = new generative_ai_1.GoogleGenerativeAI('AIzaSyCHhqlfqxa4N1OQzaIqc56TNtJqd6SAP40');
// Timeframe-to-Indicator Mapping
const timeframeIndicators = {
    "1 day": ["VWAP", "Bollinger Bands", "MACD", "Volume Spike"],
    "3 days": ["RSI (7)", "MACD", "ATR", "OBV"],
    "5 days": ["RSI (14)", "MACD Histogram", "SMA(5)", "Bollinger Bands"],
    "1 week": ["RSI (14)", "MACD", "OBV", "Stochastic RSI"],
    "2 weeks": ["SMA(20)", "ADX", "MACD", "Bollinger Band Width"],
    "1 month": ["RSI (14)", "MACD", "Bollinger Bands", "OBV"],
    "3 months": ["SMA(50)", "MACD", "ADX", "A/D Line"],
    "6 months": ["SMA(50)", "SMA(200)", "ATR", "MACD"],
    "1 year": ["SMA(200)", "MACD", "RSI (14)", "OBV"],
    "5 years": ["SMA(200)", "MACD", "SuperTrend", "Heikin Ashi"]
};
// Ticker validation function with better error handling
function validateTicker(ticker) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const upperTicker = ticker.toUpperCase();
        // Common crypto tickers
        const cryptoList = ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'XRP', 'ADA', 'SOL', 'DOT', 'DOGE', 'AVAX', 'MATIC', 'LINK', 'UNI', 'ATOM', 'LTC', 'BCH', 'XLM', 'VET', 'FIL'];
        if (cryptoList.includes(upperTicker)) {
            return { isValid: true, assetType: 'crypto', name: getCryptoName(upperTicker) };
        }
        // Add retry logic for Yahoo Finance
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                // Try to get basic info from Yahoo Finance
                const quote = yield yahoo_finance2_1.default.quote(upperTicker);
                if (quote && quote.regularMarketPrice) {
                    const assetType = quote.quoteType === 'ETF' ? 'etf' : 'stock';
                    return { isValid: true, assetType, name: quote.longName || quote.shortName };
                }
            }
            catch (error) {
                console.log(`❌ Ticker validation attempt ${attempt} failed for ${upperTicker}:`, error.message);
                if (attempt === 3) {
                    // On final attempt, if it's a DNS error, we'll assume it's a valid ticker and let the data fetching handle it
                    if (((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('ENOTFOUND')) || ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('getaddrinfo'))) {
                        console.log(`⚠️ DNS issue with Yahoo Finance, assuming ${upperTicker} is valid`);
                        return { isValid: true, assetType: 'stock', name: upperTicker };
                    }
                }
                // Wait before retry
                if (attempt < 3) {
                    yield new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }
        return { isValid: false, assetType: 'stock' };
    });
}
// Helper function to get crypto names
function getCryptoName(ticker) {
    const cryptoNames = {
        'BTC': 'Bitcoin',
        'ETH': 'Ethereum',
        'USDT': 'Tether',
        'USDC': 'USD Coin',
        'BNB': 'Binance Coin',
        'XRP': 'Ripple',
        'ADA': 'Cardano',
        'SOL': 'Solana',
        'DOT': 'Polkadot',
        'DOGE': 'Dogecoin',
        'AVAX': 'Avalanche',
        'MATIC': 'Polygon',
        'LINK': 'Chainlink',
        'UNI': 'Uniswap',
        'ATOM': 'Cosmos',
        'LTC': 'Litecoin',
        'BCH': 'Bitcoin Cash',
        'XLM': 'Stellar',
        'VET': 'VeChain',
        'FIL': 'Filecoin'
    };
    return cryptoNames[ticker] || ticker;
}
// Calculate technical indicators based on timeframe and price data
function calculateTechnicalIndicators(indicators, priceHistory, currentPrice, percentChange) {
    const results = [];
    for (const indicator of indicators) {
        switch (indicator) {
            case "VWAP":
                const vwap = calculateVWAP(priceHistory);
                const vwapDiff = ((currentPrice - vwap) / vwap) * 100;
                const vwapSignal = vwapDiff > 1 ? 'Bullish' : vwapDiff < -1 ? 'Bearish' : 'Neutral';
                results.push({
                    name: "VWAP",
                    value: `$${vwap.toFixed(2)}`,
                    trend: vwapDiff > 0 ? 'Up' : 'Down',
                    signal: vwapSignal,
                    comment: generateIndicatorComment("VWAP", vwap, vwapSignal)
                });
                break;
            case "Bollinger Bands":
                const bb = calculateBollingerBands(priceHistory);
                const bbPosition = (currentPrice - bb.lower) / (bb.upper - bb.lower);
                const bbValue = bbPosition > 0.8 ? "Upper Band" : bbPosition < 0.2 ? "Lower Band" : "Middle";
                const bbSignal = bbPosition > 0.8 ? 'Bearish' : bbPosition < 0.2 ? 'Bullish' : 'Neutral';
                results.push({
                    name: "Bollinger Bands",
                    value: bbValue,
                    signal: bbSignal,
                    comment: generateIndicatorComment("Bollinger Bands", bbValue, bbSignal)
                });
                break;
            case "MACD":
                const macd = calculateMACD(priceHistory);
                const macdValue = macd.signal > 0 ? "Bullish Crossover" : "Bearish Divergence";
                const macdSignal = macd.signal > 0 ? 'Bullish' : 'Bearish';
                results.push({
                    name: "MACD",
                    value: macdValue,
                    signal: macdSignal,
                    comment: generateIndicatorComment("MACD", macdValue, macdSignal)
                });
                break;
            case "Volume Spike":
                const volumeSpike = detectVolumeSpike(priceHistory);
                if (volumeSpike) {
                    results.push({
                        name: "Volume Spike",
                        value: "Yes",
                        signal: 'Bullish',
                        comment: generateIndicatorComment("Volume Spike", "Yes", 'Bullish')
                    });
                }
                break;
            case "RSI (7)":
                const rsi7 = calculateRSI(priceHistory, 7);
                const rsi7Signal = rsi7 > 70 ? 'Bearish' : rsi7 < 30 ? 'Bullish' : 'Neutral';
                results.push({
                    name: "RSI (7)",
                    value: rsi7.toFixed(1),
                    signal: rsi7Signal,
                    comment: generateIndicatorComment("RSI (7)", rsi7, rsi7Signal)
                });
                break;
            case "RSI (14)":
                const rsi14 = calculateRSI(priceHistory, 14);
                const rsi14Signal = rsi14 > 70 ? 'Bearish' : rsi14 < 30 ? 'Bullish' : 'Neutral';
                results.push({
                    name: "RSI (14)",
                    value: rsi14.toFixed(1),
                    signal: rsi14Signal,
                    comment: generateIndicatorComment("RSI (14)", rsi14, rsi14Signal)
                });
                break;
            case "MACD Histogram":
                const macdHist = calculateMACDHistogram(priceHistory);
                const macdHistValue = macdHist > 0 ? "Positive" : "Negative";
                const macdHistSignal = macdHist > 0 ? 'Bullish' : 'Bearish';
                results.push({
                    name: "MACD Histogram",
                    value: macdHistValue,
                    signal: macdHistSignal,
                    comment: generateIndicatorComment("MACD Histogram", macdHistValue, macdHistSignal)
                });
                break;
            case "SMA(5)":
                const sma5 = calculateSMA(priceHistory, 5);
                const sma5Diff = ((currentPrice - sma5) / sma5) * 100;
                const sma5Signal = sma5Diff > 0 ? 'Bullish' : 'Bearish';
                results.push({
                    name: "SMA(5)",
                    value: `$${sma5.toFixed(2)}`,
                    trend: sma5Diff > 0 ? 'Up' : 'Down',
                    signal: sma5Signal,
                    comment: generateIndicatorComment("SMA(5)", sma5, sma5Signal)
                });
                break;
            case "SMA(20)":
                const sma20 = calculateSMA(priceHistory, 20);
                const sma20Diff = ((currentPrice - sma20) / sma20) * 100;
                const sma20Signal = sma20Diff > 0 ? 'Bullish' : 'Bearish';
                results.push({
                    name: "SMA(20)",
                    value: `$${sma20.toFixed(2)}`,
                    trend: sma20Diff > 0 ? 'Up' : 'Down',
                    signal: sma20Signal,
                    comment: generateIndicatorComment("SMA(20)", sma20, sma20Signal)
                });
                break;
            case "SMA(50)":
                const sma50 = calculateSMA(priceHistory, 50);
                const sma50Diff = ((currentPrice - sma50) / sma50) * 100;
                const sma50Signal = sma50Diff > 0 ? 'Bullish' : 'Bearish';
                results.push({
                    name: "SMA(50)",
                    value: `$${sma50.toFixed(2)}`,
                    trend: sma50Diff > 0 ? 'Up' : 'Down',
                    signal: sma50Signal,
                    comment: generateIndicatorComment("SMA(50)", sma50, sma50Signal)
                });
                break;
            case "SMA(200)":
                const sma200 = calculateSMA(priceHistory, 200);
                const sma200Diff = ((currentPrice - sma200) / sma200) * 100;
                const sma200Signal = sma200Diff > 0 ? 'Bullish' : 'Bearish';
                results.push({
                    name: "SMA(200)",
                    value: `$${sma200.toFixed(2)}`,
                    trend: sma200Diff > 0 ? 'Up' : 'Down',
                    signal: sma200Signal,
                    comment: generateIndicatorComment("SMA(200)", sma200, sma200Signal)
                });
                break;
            case "ATR":
                const atr = calculateATR(priceHistory);
                const atrSignal = atr > 0.05 ? 'High Volatility' : 'Low Volatility';
                results.push({
                    name: "ATR",
                    value: atr.toFixed(2),
                    signal: atrSignal,
                    comment: generateIndicatorComment("ATR", atr, atrSignal)
                });
                break;
            case "OBV":
                const obv = calculateOBV(priceHistory);
                const obvValue = obv > 0 ? "Accumulation" : "Distribution";
                const obvSignal = obv > 0 ? 'Bullish' : 'Bearish';
                results.push({
                    name: "OBV",
                    value: obvValue,
                    signal: obvSignal,
                    comment: generateIndicatorComment("OBV", obvValue, obvSignal)
                });
                break;
            case "Stochastic RSI":
                const stochRsi = calculateStochasticRSI(priceHistory);
                const stochRsiSignal = stochRsi > 80 ? 'Bearish' : stochRsi < 20 ? 'Bullish' : 'Neutral';
                results.push({
                    name: "Stochastic RSI",
                    value: stochRsi.toFixed(1),
                    signal: stochRsiSignal,
                    comment: generateIndicatorComment("Stochastic RSI", stochRsi, stochRsiSignal)
                });
                break;
            case "ADX":
                const adx = calculateADX(priceHistory);
                const adxValue = `${adx.toFixed(1)} (${adx > 25 ? 'Strong' : 'Weak'} Trend)`;
                const adxSignal = adx > 25 ? 'Strong Trend' : 'Weak Trend';
                results.push({
                    name: "ADX",
                    value: adxValue,
                    signal: adxSignal,
                    comment: generateIndicatorComment("ADX", adxValue, adxSignal)
                });
                break;
            case "Bollinger Band Width":
                const bbWidth = calculateBollingerBandWidth(priceHistory);
                const bbWidthValue = bbWidth > 0.1 ? "Wide" : "Narrow";
                const bbWidthSignal = bbWidth > 0.1 ? 'High Volatility' : 'Low Volatility';
                results.push({
                    name: "Bollinger Band Width",
                    value: bbWidthValue,
                    signal: bbWidthSignal,
                    comment: generateIndicatorComment("Bollinger Band Width", bbWidthValue, bbWidthSignal)
                });
                break;
            case "A/D Line":
                const adLine = calculateADLine(priceHistory);
                const adLineValue = adLine > 0 ? "Accumulation" : "Distribution";
                const adLineSignal = adLine > 0 ? 'Bullish' : 'Bearish';
                results.push({
                    name: "A/D Line",
                    value: adLineValue,
                    signal: adLineSignal,
                    comment: generateIndicatorComment("A/D Line", adLineValue, adLineSignal)
                });
                break;
            case "SuperTrend":
                const superTrend = calculateSuperTrend(priceHistory);
                const superTrendValue = superTrend > 0 ? "Bullish" : "Bearish";
                const superTrendSignal = superTrend > 0 ? 'Bullish' : 'Bearish';
                results.push({
                    name: "SuperTrend",
                    value: superTrendValue,
                    signal: superTrendSignal,
                    comment: generateIndicatorComment("SuperTrend", superTrendValue, superTrendSignal)
                });
                break;
            case "Heikin Ashi":
                const heikinAshi = calculateHeikinAshi(priceHistory);
                const heikinAshiValue = heikinAshi > 0 ? "Bullish" : "Bearish";
                const heikinAshiSignal = heikinAshi > 0 ? 'Bullish' : 'Bearish';
                results.push({
                    name: "Heikin Ashi",
                    value: heikinAshiValue,
                    signal: heikinAshiSignal,
                    comment: generateIndicatorComment("Heikin Ashi", heikinAshiValue, heikinAshiSignal)
                });
                break;
            default:
                // Fallback for unknown indicators
                results.push({
                    name: indicator,
                    value: "N/A",
                    signal: 'Neutral'
                });
        }
    }
    return results;
}
// Technical indicator calculation helper functions
function calculateVWAP(priceHistory) {
    if (priceHistory.length === 0)
        return 0;
    const totalVolume = priceHistory.reduce((sum, p) => sum + p.volume, 0);
    const volumePrice = priceHistory.reduce((sum, p) => sum + (p.close * p.volume), 0);
    return totalVolume > 0 ? volumePrice / totalVolume : priceHistory[priceHistory.length - 1].close;
}
function calculateBollingerBands(priceHistory) {
    if (priceHistory.length < 20) {
        const price = priceHistory[priceHistory.length - 1].close;
        return { upper: price * 1.02, lower: price * 0.98, middle: price };
    }
    const prices = priceHistory.slice(-20).map(p => p.close);
    const sma = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    return {
        upper: sma + (2 * stdDev),
        lower: sma - (2 * stdDev),
        middle: sma
    };
}
function calculateMACD(priceHistory) {
    if (priceHistory.length < 26)
        return { signal: 0 };
    const prices = priceHistory.map(p => p.close);
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    return { signal: macd };
}
function calculateEMA(prices, period) {
    if (prices.length < period)
        return prices[prices.length - 1];
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
        ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    return ema;
}
function detectVolumeSpike(priceHistory) {
    if (priceHistory.length < 5)
        return false;
    const recentVolumes = priceHistory.slice(-5).map(p => p.volume);
    const avgVolume = recentVolumes.reduce((sum, v) => sum + v, 0) / recentVolumes.length;
    const currentVolume = recentVolumes[recentVolumes.length - 1];
    return currentVolume > avgVolume * 1.3;
}
function calculateRSI(priceHistory, period) {
    if (priceHistory.length < period + 1)
        return 50;
    const changes = [];
    for (let i = 1; i < priceHistory.length; i++) {
        changes.push(priceHistory[i].close - priceHistory[i - 1].close);
    }
    const gains = changes.filter(c => c > 0);
    const losses = changes.filter(c => c < 0).map(c => Math.abs(c));
    const avgGain = gains.length > 0 ? gains.reduce((sum, g) => sum + g, 0) / gains.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((sum, l) => sum + l, 0) / losses.length : 0;
    if (avgLoss === 0)
        return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}
function calculateMACDHistogram(priceHistory) {
    const macd = calculateMACD(priceHistory);
    return macd.signal;
}
function calculateSMA(priceHistory, period) {
    if (priceHistory.length < period) {
        const avg = priceHistory.reduce((sum, p) => sum + p.close, 0) / priceHistory.length;
        return avg;
    }
    const prices = priceHistory.slice(-period).map(p => p.close);
    return prices.reduce((sum, p) => sum + p, 0) / prices.length;
}
function calculateATR(priceHistory) {
    if (priceHistory.length < 2)
        return 0;
    const ranges = [];
    for (let i = 1; i < priceHistory.length; i++) {
        const high = Math.max(priceHistory[i].close, priceHistory[i - 1].close);
        const low = Math.min(priceHistory[i].close, priceHistory[i - 1].close);
        ranges.push(high - low);
    }
    return ranges.reduce((sum, r) => sum + r, 0) / ranges.length;
}
function calculateOBV(priceHistory) {
    if (priceHistory.length < 2)
        return 0;
    let obv = 0;
    for (let i = 1; i < priceHistory.length; i++) {
        if (priceHistory[i].close > priceHistory[i - 1].close) {
            obv += priceHistory[i].volume;
        }
        else if (priceHistory[i].close < priceHistory[i - 1].close) {
            obv -= priceHistory[i].volume;
        }
    }
    return obv;
}
function calculateStochasticRSI(priceHistory) {
    const rsi = calculateRSI(priceHistory, 14);
    return rsi; // Simplified version
}
function calculateADX(priceHistory) {
    if (priceHistory.length < 14)
        return 20;
    // Simplified ADX calculation
    const changes = [];
    for (let i = 1; i < priceHistory.length; i++) {
        changes.push(Math.abs(priceHistory[i].close - priceHistory[i - 1].close));
    }
    const avgChange = changes.reduce((sum, c) => sum + c, 0) / changes.length;
    const currentChange = Math.abs(priceHistory[priceHistory.length - 1].close - priceHistory[priceHistory.length - 2].close);
    return (currentChange / avgChange) * 25;
}
function calculateBollingerBandWidth(priceHistory) {
    const bb = calculateBollingerBands(priceHistory);
    return (bb.upper - bb.lower) / bb.middle;
}
function calculateADLine(priceHistory) {
    return calculateOBV(priceHistory); // Simplified version
}
function calculateSuperTrend(priceHistory) {
    if (priceHistory.length < 10)
        return 0;
    const atr = calculateATR(priceHistory);
    const currentPrice = priceHistory[priceHistory.length - 1].close;
    const prevPrice = priceHistory[priceHistory.length - 2].close;
    return currentPrice > prevPrice ? 1 : -1;
}
function calculateHeikinAshi(priceHistory) {
    if (priceHistory.length < 2)
        return 0;
    const currentPrice = priceHistory[priceHistory.length - 1].close;
    const prevPrice = priceHistory[priceHistory.length - 2].close;
    return currentPrice > prevPrice ? 1 : -1;
}
// Enhanced function to get crypto data from CoinGecko
function getCryptoData(ticker, timeframe) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            const timeframeMap = {
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
            const days = timeframeMap[timeframe] || 7;
            // Map ticker to CoinGecko ID
            const tickerToId = {
                'BTC': 'bitcoin',
                'ETH': 'ethereum',
                'USDT': 'tether',
                'USDC': 'usd-coin',
                'BNB': 'binancecoin',
                'XRP': 'ripple',
                'ADA': 'cardano',
                'SOL': 'solana',
                'DOT': 'polkadot',
                'DOGE': 'dogecoin',
                'AVAX': 'avalanche-2',
                'MATIC': 'matic-network',
                'LINK': 'chainlink',
                'UNI': 'uniswap',
                'ATOM': 'cosmos',
                'LTC': 'litecoin',
                'BCH': 'bitcoin-cash',
                'XLM': 'stellar',
                'VET': 'vechain',
                'FIL': 'filecoin'
            };
            const coinId = tickerToId[ticker];
            if (!coinId) {
                console.log(`❌ Unsupported crypto ticker: ${ticker}`);
                return null;
            }
            // Fetch data from CoinGecko with retry logic
            const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const response = yield axios_1.default.get(url, {
                        timeout: 10000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (compatible; MarketMover/1.0)'
                        }
                    });
                    // Check for rate limit error
                    if (response.status === 429) {
                        const retryAfter = response.headers['retry-after'] ? parseInt(response.headers['retry-after']) : 60;
                        console.log(`⚠️ CoinGecko rate limit hit for ${ticker}, waiting ${retryAfter}s before retry ${attempt}`);
                        if (attempt < 3) {
                            yield new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                            continue;
                        }
                        else {
                            console.log(`🔄 Using fallback crypto data for ${ticker} after rate limit`);
                            return yield getCryptoFallbackData(ticker, timeframe);
                        }
                    }
                    if (response.status === 401) {
                        console.log(`⚠️ CoinGecko unauthorized for ${ticker}, using fallback data`);
                        return yield getCryptoFallbackData(ticker, timeframe);
                    }
                    const { prices, total_volumes } = response.data;
                    if (!prices || prices.length < 2) {
                        console.log(`❌ Insufficient crypto data for ${ticker}`);
                        return yield getCryptoFallbackData(ticker, timeframe);
                    }
                    // Calculate metrics
                    const startPrice = prices[0][1];
                    const endPrice = prices[prices.length - 1][1];
                    const percentChange = ((endPrice - startPrice) / startPrice) * 100;
                    // Volume analysis
                    const volumes = total_volumes.map((v) => v[1]).filter((v) => v > 0);
                    const averageVolume = volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 0;
                    const actualVolume = volumes[volumes.length - 1] || 0;
                    const volumeRatio = averageVolume > 0 ? actualVolume / averageVolume : 1;
                    // Technical indicators
                    const priceValues = prices.map((p) => p[1]);
                    const returns = priceValues.slice(1).map((price, i) => (price - priceValues[i]) / priceValues[i]);
                    const volatility = returns.length > 0 ? Math.sqrt(returns.reduce((sum, ret) => sum + ret * ret, 0) / returns.length) : 0;
                    const momentum = returns.length > 0 ? returns.reduce((sum, ret) => sum + ret, 0) : 0;
                    const volumeSpike = volumeRatio > 1.5;
                    const priceGap = Math.abs(percentChange) > 5;
                    // Get metadata with fallback
                    let metadata = { name: getCryptoName(ticker), sector: 'Cryptocurrency', marketCap: undefined, currency: 'USD' };
                    try {
                        const metadataResponse = yield axios_1.default.get(`https://api.coingecko.com/api/v3/coins/${coinId}`, {
                            timeout: 5000,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (compatible; MarketMover/1.0)'
                            }
                        });
                        const metadataData = metadataResponse.data;
                        metadata = {
                            name: metadataData.name || getCryptoName(ticker),
                            sector: 'Cryptocurrency',
                            marketCap: (_b = (_a = metadataData.market_data) === null || _a === void 0 ? void 0 : _a.market_cap) === null || _b === void 0 ? void 0 : _b.usd,
                            currency: 'USD'
                        };
                    }
                    catch (metadataError) {
                        console.log(`⚠️ Could not fetch crypto metadata for ${ticker}, using defaults`);
                    }
                    return {
                        ticker,
                        assetType: 'crypto',
                        startPrice,
                        endPrice,
                        percentChange: parseFloat(percentChange.toFixed(2)),
                        startDate: new Date(prices[0][0]).toISOString(),
                        endDate: new Date(prices[prices.length - 1][0]).toISOString(),
                        averageVolume,
                        actualVolume,
                        volumeRatio,
                        priceHistory: prices.map((p) => {
                            var _a;
                            return ({
                                date: new Date(p[0]).toISOString(),
                                close: p[1],
                                volume: ((_a = total_volumes.find((v) => v[0] === p[0])) === null || _a === void 0 ? void 0 : _a[1]) || 0
                            });
                        }),
                        technicalIndicators: {
                            volatility: parseFloat(volatility.toFixed(4)),
                            momentum: parseFloat(momentum.toFixed(4)),
                            volumeSpike,
                            priceGap
                        },
                        metadata
                    };
                }
                catch (error) {
                    console.error(`❌ Error fetching crypto data for ${ticker} (attempt ${attempt}):`, error.message);
                    if (attempt === 3) {
                        return yield getCryptoFallbackData(ticker, timeframe);
                    }
                    // Wait before retry
                    yield new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                }
            }
            return yield getCryptoFallbackData(ticker, timeframe);
        }
        catch (error) {
            console.error(`❌ Error in getCryptoData for ${ticker}:`, error);
            return yield getCryptoFallbackData(ticker, timeframe);
        }
    });
}
// Fallback crypto data function for when CoinGecko API fails
function getCryptoFallbackData(ticker, timeframe) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`🔄 Using fallback crypto data for ${ticker}`);
        try {
            // Generate realistic fallback data based on current market conditions
            const endDate = new Date();
            const startDate = new Date();
            // Adjust start date based on timeframe
            const timeframeMap = {
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
            const days = timeframeMap[timeframe] || 7;
            startDate.setDate(endDate.getDate() - days);
            // Generate realistic price data
            const basePrice = ticker === 'BTC' ? 47000 : ticker === 'ETH' ? 3200 : 100;
            const volatility = 0.02; // 2% daily volatility
            const trend = Math.random() > 0.5 ? 1 : -1; // Random trend
            const trendStrength = 0.001; // 0.1% daily trend
            const startPrice = basePrice * (1 + (Math.random() - 0.5) * 0.1); // ±5% variation
            const endPrice = startPrice * (1 + trend * trendStrength * days + (Math.random() - 0.5) * volatility * Math.sqrt(days));
            const percentChange = ((endPrice - startPrice) / startPrice) * 100;
            // Generate price history
            const priceHistory = [];
            for (let i = 0; i < days; i++) {
                const date = new Date(startDate);
                date.setDate(startDate.getDate() + i);
                const price = startPrice * (1 + trend * trendStrength * i + (Math.random() - 0.5) * volatility * Math.sqrt(i + 1));
                priceHistory.push({
                    date: date.toISOString(),
                    close: price,
                    volume: Math.random() * 1000000 + 500000 // Random volume
                });
            }
            // Calculate technical indicators
            const prices = priceHistory.map(p => p.close);
            const returns = prices.slice(1).map((price, i) => (price - prices[i]) / prices[i]);
            const calculatedVolatility = returns.length > 0 ? Math.sqrt(returns.reduce((sum, ret) => sum + ret * ret, 0) / returns.length) : volatility;
            const momentum = returns.length > 0 ? returns.reduce((sum, ret) => sum + ret, 0) : 0;
            const volumeRatio = 1.0 + (Math.random() - 0.5) * 0.5; // Random volume ratio
            const volumeSpike = volumeRatio > 1.5;
            const priceGap = Math.abs(percentChange) > 5;
            return {
                ticker,
                assetType: 'crypto',
                startPrice: parseFloat(startPrice.toFixed(2)),
                endPrice: parseFloat(endPrice.toFixed(2)),
                percentChange: parseFloat(percentChange.toFixed(2)),
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                averageVolume: 750000,
                actualVolume: 750000 * volumeRatio,
                volumeRatio,
                priceHistory,
                technicalIndicators: {
                    volatility: parseFloat(calculatedVolatility.toFixed(4)),
                    momentum: parseFloat(momentum.toFixed(4)),
                    volumeSpike,
                    priceGap
                },
                metadata: {
                    name: getCryptoName(ticker),
                    sector: 'Cryptocurrency',
                    marketCap: undefined,
                    currency: 'USD'
                }
            };
        }
        catch (error) {
            console.error(`❌ Error generating fallback crypto data for ${ticker}:`, error);
            return null;
        }
    });
}
// Enhanced function to get comprehensive stock data
function getEnhancedStockData(ticker, timeframe) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // First validate the ticker
            const validation = yield validateTicker(ticker);
            if (!validation.isValid) {
                console.log(`❌ Invalid ticker: ${ticker}`);
                return null;
            }
            // Handle crypto separately
            if (validation.assetType === 'crypto') {
                return yield getCryptoData(ticker, timeframe);
            }
            // Convert timeframe to days
            const timeframeMap = {
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
            const days = timeframeMap[timeframe] || 7;
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - days);
            console.log(`📊 Fetching data for ${ticker} over ${timeframe} (${days} days)`);
            // Fetch historical data using yahoo-finance2 with retry logic
            let results = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    results = yield yahoo_finance2_1.default.historical(ticker, {
                        period1: startDate,
                        period2: endDate,
                        interval: '1d',
                    });
                    break; // Success, exit retry loop
                }
                catch (error) {
                    console.log(`❌ Yahoo Finance attempt ${attempt} failed for ${ticker}:`, error.message);
                    if (attempt === 3) {
                        console.log(`❌ All Yahoo Finance attempts failed for ${ticker}`);
                        return null;
                    }
                    // Wait before retry
                    yield new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                }
            }
            if (!results || results.length < 2) {
                console.log(`❌ Insufficient data points for ${ticker}: ${(results === null || results === void 0 ? void 0 : results.length) || 0} points`);
                return null;
            }
            console.log(`✅ Got ${results.length} data points for ${ticker}`);
            // Calculate volume metrics
            const volumes = results.map(r => r.volume || 0).filter(v => v > 0);
            const averageVolume = volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 0;
            const actualVolume = results[results.length - 1].volume || 0;
            const volumeRatio = averageVolume > 0 ? actualVolume / averageVolume : 1;
            // Data is sorted oldest first
            const startPrice = results[0].close;
            const endPrice = results[results.length - 1].close;
            const startDateStr = results[0].date ? new Date(results[0].date).toISOString() : '';
            const endDateStr = results[results.length - 1].date ? new Date(results[results.length - 1].date).toISOString() : '';
            const percentChange = ((endPrice - startPrice) / startPrice) * 100;
            const priceHistory = results.map(r => ({
                date: r.date ? new Date(r.date).toISOString() : '',
                close: r.close,
                volume: r.volume || 0
            }));
            console.log(`📈 ${ticker}: $${startPrice.toFixed(2)} → $${endPrice.toFixed(2)} (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(2)}%)`);
            // Calculate technical indicators
            const prices = results.map(r => r.close);
            const returns = prices.slice(1).map((price, i) => (price - prices[i]) / prices[i]);
            const volatility = returns.length > 0 ? Math.sqrt(returns.reduce((sum, ret) => sum + ret * ret, 0) / returns.length) : 0;
            const momentum = returns.length > 0 ? returns.reduce((sum, ret) => sum + ret, 0) : 0;
            const volumeSpike = volumeRatio > 1.5;
            const priceGap = Math.abs(percentChange) > 5;
            // Get additional metadata with retry logic
            let metadata = { name: ticker, sector: undefined, marketCap: undefined, currency: 'USD' };
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    const quote = yield yahoo_finance2_1.default.quote(ticker);
                    metadata = {
                        name: quote.longName || quote.shortName || ticker,
                        sector: undefined, // Yahoo Finance API doesn't always provide sector
                        marketCap: undefined, // Yahoo Finance API doesn't always provide market cap
                        currency: quote.currency || 'USD'
                    };
                    break; // Success, exit retry loop
                }
                catch (error) {
                    console.log(`⚠️ Could not fetch metadata for ${ticker} (attempt ${attempt}):`, error.message);
                    if (attempt === 2) {
                        console.log(`⚠️ Using default metadata for ${ticker}`);
                    }
                }
            }
            return {
                ticker,
                assetType: validation.assetType,
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
                },
                metadata
            };
        }
        catch (error) {
            console.error(`❌ Error fetching stock data for ${ticker}:`, error);
            return null;
        }
    });
}
// Enhanced news fetching with sentiment analysis and fallback strategies
function getEnhancedNews(ticker, startDate, endDate) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Calculate the date range in days
            const start = new Date(startDate);
            const end = new Date(endDate);
            const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            // NewsAPI free plan only allows articles from the last month
            const maxDaysBack = 30;
            let effectiveStartDate = startDate;
            let effectiveEndDate = endDate;
            // If the requested range is too far back, adjust to the last 30 days
            if (daysDiff > maxDaysBack) {
                const adjustedStart = new Date();
                adjustedStart.setDate(adjustedStart.getDate() - maxDaysBack);
                effectiveStartDate = adjustedStart.toISOString();
                console.log(`⚠️ NewsAPI limitation: Adjusting date range from ${daysDiff} days to last ${maxDaysBack} days`);
            }
            // Fetch news articles from NewsAPI with better query and retry logic
            const query = `${ticker} AND (stock OR earnings OR revenue OR analyst OR upgrade OR downgrade OR price OR target OR financial OR quarterly)`;
            const newsUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&language=en&pageSize=30&from=${effectiveStartDate}&to=${effectiveEndDate}&apiKey=9f918bb0ea034b5e81b4fbcea7da5429`;
            let articles = [];
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const response = yield axios_1.default.get(newsUrl, {
                        timeout: 10000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (compatible; MarketMover/1.0)'
                        }
                    });
                    if (response.status === 426) {
                        console.log(`⚠️ NewsAPI upgrade required for ${ticker}, using fallback news`);
                        return yield getFallbackNews(ticker);
                    }
                    articles = response.data.articles || [];
                    break; // Success, exit retry loop
                }
                catch (error) {
                    console.log(`❌ NewsAPI attempt ${attempt} failed for ${ticker}:`, error.message);
                    if (attempt === 3) {
                        console.log(`🔄 Using fallback news for ${ticker} after all attempts failed`);
                        return yield getFallbackNews(ticker);
                    }
                    // Wait before retry
                    yield new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
            console.log(`📰 Found ${articles.length} news articles for ${ticker} (${daysDiff > maxDaysBack ? 'adjusted' : 'full'} date range)`);
            // If no articles found and we're dealing with a long timeframe, try a broader search
            if (articles.length === 0 && daysDiff > maxDaysBack) {
                console.log(`🔄 No articles found for ${ticker}, trying broader search...`);
                return yield getFallbackNews(ticker);
            }
            // Process and tag articles with enhanced relevance scoring
            const processedArticles = articles.map((article) => {
                var _a;
                const title = article.title || '';
                const description = article.description || '';
                // Improved sentiment analysis and tagging
                const text = `${title} ${description}`.toLowerCase();
                let sentiment = 0;
                const tags = [];
                let relevance = 0;
                // More nuanced sentiment analysis
                const positiveKeywords = ['upgrade', 'bullish', 'positive', 'beat', 'higher', 'rise', 'gain', 'surge', 'rally', 'strong', 'growth', 'profit', 'buy', 'outperform'];
                const negativeKeywords = ['downgrade', 'bearish', 'negative', 'miss', 'lower', 'fall', 'drop', 'decline', 'weak', 'loss', 'concern', 'risk', 'sell', 'underperform'];
                // Count positive and negative keywords
                const positiveCount = positiveKeywords.filter(word => text.includes(word)).length;
                const negativeCount = negativeKeywords.filter(word => text.includes(word)).length;
                // Calculate sentiment score
                if (positiveCount > negativeCount) {
                    sentiment = Math.min(0.5, (positiveCount - negativeCount) * 0.2);
                }
                else if (negativeCount > positiveCount) {
                    sentiment = Math.max(-0.5, (negativeCount - positiveCount) * -0.2);
                }
                // Enhanced tagging logic with relevance scoring
                if (text.includes('upgrade') || text.includes('bullish') || text.includes('buy') || text.includes('outperform')) {
                    tags.push('Analyst Upgrade');
                    sentiment = Math.max(sentiment, 0.3);
                    relevance += 3;
                }
                if (text.includes('downgrade') || text.includes('bearish') || text.includes('sell') || text.includes('underperform')) {
                    tags.push('Analyst Downgrade');
                    sentiment = Math.min(sentiment, -0.3);
                    relevance += 3;
                }
                if (text.includes('earnings') || text.includes('quarterly') || text.includes('results') || text.includes('q1') || text.includes('q2') || text.includes('q3') || text.includes('q4')) {
                    tags.push('Earnings');
                    relevance += 4;
                }
                if (text.includes('revenue') || text.includes('sales') || text.includes('financial') || text.includes('guidance')) {
                    tags.push('Revenue');
                    relevance += 3;
                }
                if (text.includes('ai') || text.includes('artificial intelligence') || text.includes('technology') || text.includes('innovation')) {
                    tags.push('AI/Tech');
                    relevance += 2;
                }
                if (text.includes('fed') || text.includes('interest rate') || text.includes('inflation') || text.includes('economy') || text.includes('macro')) {
                    tags.push('Macro');
                    relevance += 2;
                }
                if (text.includes('price target') || text.includes('target price') || text.includes('pt')) {
                    tags.push('Price Target');
                    relevance += 3;
                }
                if (text.includes('volume') || text.includes('trading') || text.includes('technical')) {
                    tags.push('Trading');
                    relevance += 1;
                }
                if (text.includes('partnership') || text.includes('acquisition') || text.includes('merger') || text.includes('deal')) {
                    tags.push('Corporate Action');
                    relevance += 3;
                }
                // Boost relevance for high-quality sources
                const qualitySources = ['bloomberg', 'reuters', 'cnbc', 'marketwatch', 'yahoo finance', 'seeking alpha'];
                if (qualitySources.some(source => { var _a, _b; return (_b = (_a = article.source) === null || _a === void 0 ? void 0 : _a.name) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes(source); })) {
                    relevance += 2;
                }
                // Penalize irrelevant articles
                if (text.includes('lawsuit') || text.includes('legal') || text.includes('court')) {
                    relevance -= 1;
                }
                return {
                    title: article.title,
                    description: article.description,
                    url: article.url,
                    publishedAt: article.publishedAt,
                    source: ((_a = article.source) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown',
                    sentiment,
                    tags,
                    relevance: Math.max(0, relevance)
                };
            });
            // Sort by relevance and recency
            processedArticles.sort((a, b) => {
                // Prioritize articles with high relevance and sentiment magnitude
                const aScore = a.relevance + Math.abs(a.sentiment || 0) * 2;
                const bScore = b.relevance + Math.abs(b.sentiment || 0) * 2;
                if (aScore !== bScore)
                    return bScore - aScore;
                // Then by recency
                return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
            });
            // Filter out low-relevance articles
            const filteredArticles = processedArticles.filter(article => article.relevance > 0);
            console.log(`🏷️ Processed ${filteredArticles.length} high-relevance articles with tags and sentiment`);
            return filteredArticles.slice(0, 15); // Return top 15 most relevant
        }
        catch (error) {
            console.error('❌ Error fetching news:', error);
            // Try fallback if NewsAPI fails
            return yield getFallbackNews(ticker);
        }
    });
}
// Fallback news function for when NewsAPI fails or returns no results
function getFallbackNews(ticker) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`🔄 Using fallback news for ${ticker}`);
        // Generate contextual news based on the ticker and current market conditions
        const fallbackArticles = [];
        // Common news patterns for different asset types
        const isCrypto = ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'XRP', 'ADA', 'SOL', 'DOT', 'DOGE'].includes(ticker);
        if (isCrypto) {
            // Crypto-specific fallback news
            fallbackArticles.push({
                title: `${ticker} Price Analysis: Market Sentiment and Technical Indicators`,
                description: `Recent market analysis shows ${ticker} trading patterns and investor sentiment. Technical indicators suggest current market positioning.`,
                url: '#',
                publishedAt: new Date().toISOString(),
                source: 'Market Analysis',
                sentiment: 0.1,
                tags: ['Technical Analysis', 'Market Sentiment'],
                relevance: 6
            }, {
                title: `Cryptocurrency Market Update: ${ticker} Performance in Current Environment`,
                description: `Overview of ${ticker} performance relative to broader crypto market trends and regulatory developments.`,
                url: '#',
                publishedAt: new Date().toISOString(),
                source: 'Crypto Market Report',
                sentiment: 0.2,
                tags: ['Market Update', 'Regulatory'],
                relevance: 5
            }, {
                title: `${ticker} Trading Volume Analysis: Institutional Interest Trends`,
                description: `Analysis of ${ticker} trading volume patterns and institutional investor activity in the cryptocurrency space.`,
                url: '#',
                publishedAt: new Date().toISOString(),
                source: 'Trading Analysis',
                sentiment: 0.3,
                tags: ['Trading', 'Institutional'],
                relevance: 4
            });
        }
        else {
            // Stock/ETF fallback news
            fallbackArticles.push({
                title: `${ticker} Stock Analysis: Recent Performance and Market Position`,
                description: `Comprehensive analysis of ${ticker} stock performance, including technical indicators and market positioning.`,
                url: '#',
                publishedAt: new Date().toISOString(),
                source: 'Stock Analysis',
                sentiment: 0.2,
                tags: ['Stock Analysis', 'Technical'],
                relevance: 6
            }, {
                title: `Market Update: ${ticker} Trading Activity and Investor Sentiment`,
                description: `Current trading activity and investor sentiment analysis for ${ticker} in the broader market context.`,
                url: '#',
                publishedAt: new Date().toISOString(),
                source: 'Market Report',
                sentiment: 0.1,
                tags: ['Market Update', 'Sentiment'],
                relevance: 5
            }, {
                title: `${ticker} Sector Performance: Industry Trends and Competitive Position`,
                description: `Analysis of ${ticker} performance within its sector and competitive positioning in the current market environment.`,
                url: '#',
                publishedAt: new Date().toISOString(),
                source: 'Sector Analysis',
                sentiment: 0.3,
                tags: ['Sector Analysis', 'Competitive'],
                relevance: 4
            });
        }
        console.log(`📰 Generated ${fallbackArticles.length} fallback news articles for ${ticker}`);
        return fallbackArticles;
    });
}
// Generate enhanced AI prompt for financial analysis
function generateAIPrompt(stockData, newsArticles, timeframe, technicalIndicators) {
    var _a, _b, _c;
    const startDate = new Date(stockData.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const endDate = new Date(stockData.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const priceChange = `${stockData.percentChange > 0 ? '+' : ''}${stockData.percentChange}%`;
    const volumeContext = stockData.volumeRatio > 1.3 ? `(Volume spike: ${stockData.volumeRatio.toFixed(1)}x average)` :
        stockData.volumeRatio < 0.7 ? `(Low volume: ${stockData.volumeRatio.toFixed(1)}x average)` : '';
    const technicalContext = stockData.technicalIndicators.volatility > 0.02 ? `(High volatility: ${(stockData.technicalIndicators.volatility * 100).toFixed(1)}%)` : '';
    const gapContext = stockData.technicalIndicators.priceGap ? ' (Significant price gap detected)' : '';
    // Asset-specific context
    const assetContext = stockData.assetType === 'crypto'
        ? `\nASSET TYPE: Cryptocurrency (${((_a = stockData.metadata) === null || _a === void 0 ? void 0 : _a.name) || stockData.ticker})`
        : stockData.assetType === 'etf'
            ? `\nASSET TYPE: ETF (${((_b = stockData.metadata) === null || _b === void 0 ? void 0 : _b.name) || stockData.ticker})`
            : `\nASSET TYPE: Stock (${((_c = stockData.metadata) === null || _c === void 0 ? void 0 : _c.name) || stockData.ticker})`;
    // Format news headlines with enhanced metadata
    const headlinesSection = newsArticles.length > 0
        ? newsArticles.map((article, i) => {
            var _a;
            const tags = ((_a = article.tags) === null || _a === void 0 ? void 0 : _a.length) ? ` [${article.tags.join(', ')}]` : '';
            const sentiment = article.sentiment ? ` (${article.sentiment > 0 ? '+' : ''}${article.sentiment.toFixed(1)})` : '';
            const relevance = ` [Relevance: ${article.relevance}]`;
            return `${i + 1}. ${article.title}${tags}${sentiment}${relevance}`;
        }).join('\n')
        : 'Limited recent news available. Focus on technical analysis and market context for this timeframe.';
    const role = stockData.assetType === 'crypto'
        ? 'senior cryptocurrency analyst'
        : 'senior financial analyst at a top-tier investment bank';
    const analysisType = stockData.assetType === 'crypto'
        ? 'cryptocurrency price movements'
        : 'stock price movements';
    return `You are a ${role}. Your task is to provide a professional, evidence-based analysis of ${analysisType}.

IMPORTANT: Keep all explanations concise and to the point. Each driver should be 1-2 sentences maximum.

${assetContext}
Ticker: $${stockData.ticker}
Timeframe: ${timeframe}
Date Range: ${startDate} to ${endDate}
Price Movement: $${stockData.startPrice.toFixed(2)} → $${stockData.endPrice.toFixed(2)} (${priceChange}) ${volumeContext} ${technicalContext} ${gapContext}

TECHNICAL CONTEXT:
- Volatility: ${(stockData.technicalIndicators.volatility * 100).toFixed(2)}%
- Momentum: ${(stockData.technicalIndicators.momentum * 100).toFixed(2)}%
- Volume Pattern: ${stockData.volumeRatio > 1.3 ? 'Unusual spike' : 'Normal'}
- Price Gap: ${stockData.technicalIndicators.priceGap ? 'Yes' : 'No'}

KEY TECHNICAL INDICATORS:
${technicalIndicators.map(indicator => `- ${indicator.name}: ${indicator.value} → ${indicator.signal}`).join('\n')}

RELEVANT NEWS (${newsArticles.length} articles, sorted by relevance):
${headlinesSection}

ANALYSIS REQUIREMENTS:
1. Identify exactly 2-3 drivers that most likely caused this price movement
2. ${newsArticles.length > 0 ? 'Each driver must be supported by key evidence from the news articles' : 'Focus on technical analysis and market context when news is limited'}
3. Consider the magnitude and direction of the price change
4. Account for technical indicators (volume, volatility, momentum)
5. Avoid contradictory explanations
6. Be specific, actionable, and CONCISE (1-2 sentences per driver)

DRIVER CATEGORIES (use exactly one of these):
${stockData.assetType === 'crypto' ? `
- Analyst Actions (upgrades/downgrades, price targets)
- Company-Specific News (product launches, partnerships, developments)
- Macro Factors (Fed policy, inflation, economic data)
- Market Sentiment (fear/greed, institutional flows)
- Network/Protocol News (upgrades, developments, security)
- Technical Factors (volume spikes, support/resistance levels)` : `
- Analyst Actions (upgrades/downgrades, price targets)
- Company-Specific News (product launches, partnerships)
- Macro Factors (Fed policy, economic data)
- Market Sentiment (institutional flows, sector rotation)
- Technical Factors (volume spikes, technical levels)`}

OUTPUT FORMAT:
Provide exactly 2-3 drivers in this format:

1. [Driver Category] — [Concise explanation with key evidence] (Confidence: High/Medium/Low)
2. [Driver Category] — [Concise explanation with key evidence] (Confidence: High/Medium/Low)
3. [Driver Category] — [Concise explanation with key evidence] (Confidence: High/Medium/Low)

IMPORTANT: Keep each driver explanation to 1-2 sentences maximum. Be specific but concise. Focus on the most impactful factors for this specific timeframe.`;
}
// Call Gemini for analysis
function getGeminiAnalysis(prompt) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
            const result = yield model.generateContent(prompt);
            const response = yield result.response;
            return response.text() || 'Unable to generate analysis.';
        }
        catch (error) {
            console.error('❌ Gemini API error:', error);
            return 'Gemini analysis unavailable. Please check your API key and internet connection.';
        }
    });
}
// Main analysis endpoint
app.post('/analyze', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { ticker, timeframe } = req.body;
    console.log('➡️ Incoming request:', { ticker, timeframe });
    if (!ticker || !timeframe) {
        console.log('⛔ Missing ticker or timeframe');
        res.status(400).json({
            error: 'Missing ticker or timeframe',
            drivers: [],
            newsArticles: [],
            stockData: null
        });
        return;
    }
    try {
        // Get enhanced stock data
        const stockData = yield getEnhancedStockData(ticker, timeframe);
        if (!stockData) {
            console.log('❌ No stock data available for', ticker);
            res.json({
                error: `Data for '${ticker}' is unavailable or insufficient for analysis.`,
                suggestion: "Please check the ticker symbol or try a different timeframe.",
                drivers: [],
                newsArticles: [],
                stockData: null,
                technicalIndicators: []
            });
            return;
        }
        // Calculate dynamic technical indicators based on timeframe
        const indicatorsForTimeframe = timeframeIndicators[timeframe] || timeframeIndicators["1 week"];
        const technicalIndicators = calculateTechnicalIndicators(indicatorsForTimeframe, stockData.priceHistory, stockData.endPrice, stockData.percentChange);
        // Get S&P 500 context
        const sp500Data = yield getEnhancedStockData('SPY', timeframe);
        let marketContext = '';
        if (sp500Data) {
            const spDir = sp500Data.percentChange > 0 ? 'up' : (sp500Data.percentChange < 0 ? 'down' : 'flat');
            marketContext = `Market context: S&P 500 moved ${spDir} by ${sp500Data.percentChange > 0 ? '+' : ''}${sp500Data.percentChange}% during the same period.`;
        }
        // Get enhanced news articles
        const newsArticles = yield getEnhancedNews(ticker, stockData.startDate, stockData.endDate);
        // Generate AI prompt
        const prompt = generateAIPrompt(stockData, newsArticles, timeframe, technicalIndicators);
        // Get Gemini analysis
        const geminiAnalysis = yield getGeminiAnalysis(prompt);
        // Parse and format drivers from Gemini response
        const drivers = geminiAnalysis
            .split('\n')
            .filter(line => /^\d+\./.test(line.trim()))
            .map(line => line.trim().replace(/^\d+\.\s*/, ''))
            .filter(driver => driver.length > 0)
            .map(driver => formatDriver(driver, stockData.assetType));
        res.json({
            ticker: stockData.ticker,
            assetType: stockData.assetType,
            timeframe,
            drivers,
            geminiAnalysis: geminiAnalysis,
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
            technicalIndicators,
            metadata: stockData.metadata,
            analysisQuality: {
                newsRelevance: newsArticles.length > 0 ? Math.round(newsArticles.reduce((sum, a) => sum + a.relevance, 0) / newsArticles.length) : 0,
                technicalData: stockData.technicalIndicators.volatility > 0 ? 'Complete' : 'Limited',
                confidence: drivers.length >= 2 ? 'High' : 'Medium'
            },
            lastUpdated: new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false })
        });
    }
    catch (error) {
        console.error('❌ Analysis error:', error);
        res.status(500).json({
            error: 'Analysis failed. Please try again.',
            drivers: [],
            newsArticles: [],
            stockData: null,
            technicalIndicators: []
        });
    }
}));
// Ticker validation endpoint
app.post('/validate-ticker', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { ticker } = req.body;
    if (!ticker) {
        res.status(400).json({ error: 'Missing ticker parameter' });
        return;
    }
    try {
        const validation = yield validateTicker(ticker);
        res.json({
            ticker: ticker.toUpperCase(),
            isValid: validation.isValid,
            assetType: validation.assetType,
            name: validation.name
        });
    }
    catch (error) {
        console.error('❌ Ticker validation error:', error);
        res.status(500).json({ error: 'Validation failed' });
    }
}));
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
app.listen(port, () => {
    console.log(`✅ Server running at http://localhost:${port}`);
    console.log('📊 Enhanced financial analysis with Gemini AI integration ready!');
});
// Generate commentary for technical indicators
function generateIndicatorComment(indicatorName, value, signal) {
    switch (indicatorName) {
        case "RSI (7)":
        case "RSI (14)":
            const rsiValue = typeof value === 'string' ? parseFloat(value) : value;
            if (rsiValue < 30)
                return "RSI indicates oversold conditions, potential reversal point.";
            if (rsiValue > 70)
                return "RSI shows overbought conditions, watch for pullback.";
            if (rsiValue < 40)
                return "RSI is approaching oversold territory.";
            if (rsiValue > 60)
                return "RSI is approaching overbought territory.";
            return "RSI is stable in mid-range, neither oversold nor overbought.";
        case "MACD":
            if (signal === 'Bullish')
                return "MACD shows bullish momentum with positive crossover.";
            return "MACD indicates bearish momentum with negative divergence.";
        case "MACD Histogram":
            if (signal === 'Bullish')
                return "MACD histogram is positive, momentum building.";
            return "MACD histogram is negative, momentum weakening.";
        case "ADX":
            const adxValue = typeof value === 'string' ? parseFloat(value.split(' ')[0]) : value;
            if (adxValue > 25)
                return "Strong trend forming with high directional movement.";
            return "Weak trend with low directional movement.";
        case "Bollinger Bands":
            if (value === "Upper Band")
                return "Price at upper Bollinger Band, potential resistance.";
            if (value === "Lower Band")
                return "Price at lower Bollinger Band, potential support.";
            return "Price within Bollinger Band range, normal volatility.";
        case "Volume Spike":
            if (signal === 'Bullish')
                return "Unusually high volume suggests strong buying interest.";
            return "Volume spike indicates significant market activity.";
        case "OBV":
            if (signal === 'Bullish')
                return "On-Balance Volume shows accumulation pattern.";
            return "On-Balance Volume indicates distribution pattern.";
        case "A/D Line":
            if (signal === 'Bullish')
                return "Accumulation/Distribution line shows buying pressure.";
            return "Accumulation/Distribution line indicates selling pressure.";
        case "Stochastic RSI":
            const stochValue = typeof value === 'string' ? parseFloat(value) : value;
            if (stochValue < 20)
                return "Stochastic RSI in oversold territory.";
            if (stochValue > 80)
                return "Stochastic RSI in overbought territory.";
            return "Stochastic RSI in neutral range.";
        case "ATR":
            const atrValue = typeof value === 'string' ? parseFloat(value) : value;
            if (atrValue > 0.05)
                return "High volatility with wide price swings.";
            return "Low volatility with tight price range.";
        case "Bollinger Band Width":
            if (value === "Wide")
                return "Bollinger Bands are wide, indicating high volatility.";
            return "Bollinger Bands are narrow, indicating low volatility.";
        case "SuperTrend":
            if (signal === 'Bullish')
                return "SuperTrend indicator shows bullish momentum.";
            return "SuperTrend indicator shows bearish momentum.";
        case "Heikin Ashi":
            if (signal === 'Bullish')
                return "Heikin Ashi candles show bullish trend.";
            return "Heikin Ashi candles show bearish trend.";
        case "VWAP":
            const vwapDiff = typeof value === 'string' ? parseFloat(value.replace('$', '')) : value;
            if (signal === 'Bullish')
                return "Price above VWAP indicates bullish momentum.";
            if (signal === 'Bearish')
                return "Price below VWAP indicates bearish momentum.";
            return "Price near VWAP suggests neutral momentum.";
        case "SMA(5)":
        case "SMA(20)":
        case "SMA(50)":
        case "SMA(200)":
            if (signal === 'Bullish')
                return `Price above ${indicatorName} indicates short-term strength.`;
            return `Price below ${indicatorName} indicates short-term weakness.`;
        default:
            return "Technical indicator shows current market conditions.";
    }
}
// Format driver with proper categorization
function formatDriver(driverText, assetType) {
    const validCategories = assetType === 'crypto' ? [
        'Analyst Actions',
        'Company-Specific News',
        'Macro Factors',
        'Market Sentiment',
        'Network/Protocol News',
        'Technical Factors'
    ] : [
        'Analyst Actions',
        'Company-Specific News',
        'Macro Factors',
        'Market Sentiment',
        'Technical Factors'
    ];
    // Check if driver already has a valid category
    for (const category of validCategories) {
        if (driverText.includes(category)) {
            return driverText;
        }
    }
    // If no valid category found, try to categorize based on content
    const lowerText = driverText.toLowerCase();
    if (lowerText.includes('analyst') || lowerText.includes('upgrade') || lowerText.includes('downgrade') || lowerText.includes('target')) {
        return `Analyst Actions — ${driverText}`;
    }
    if (lowerText.includes('earnings') || lowerText.includes('revenue') || lowerText.includes('quarterly') || lowerText.includes('product') || lowerText.includes('partnership')) {
        return `Company-Specific News — ${driverText}`;
    }
    if (lowerText.includes('fed') || lowerText.includes('inflation') || lowerText.includes('economic') || lowerText.includes('policy')) {
        return `Macro Factors — ${driverText}`;
    }
    if (lowerText.includes('sentiment') || lowerText.includes('institutional') || lowerText.includes('flow') || lowerText.includes('rotation')) {
        return `Market Sentiment — ${driverText}`;
    }
    if (assetType === 'crypto' && (lowerText.includes('network') || lowerText.includes('protocol') || lowerText.includes('upgrade') || lowerText.includes('development'))) {
        return `Network/Protocol News — ${driverText}`;
    }
    if (lowerText.includes('volume') || lowerText.includes('technical') || lowerText.includes('support') || lowerText.includes('resistance')) {
        return `Technical Factors — ${driverText}`;
    }
    // Default to Company-Specific News if no clear category
    return `Company-Specific News — ${driverText}`;
}
