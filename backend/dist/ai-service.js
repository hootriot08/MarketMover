"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const openai_1 = __importDefault(require("openai"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const ollama_1 = require("ollama");
class AIService {
    constructor() {
        this.openai = null;
        this.anthropic = null;
        this.ollama = null;
        this.provider = process.env.AI_PROVIDER || 'openai';
        // Initialize OpenAI
        if (process.env.OPENAI_API_KEY) {
            this.openai = new openai_1.default({
                apiKey: process.env.OPENAI_API_KEY,
            });
        }
        // Initialize Anthropic
        if (process.env.ANTHROPIC_API_KEY) {
            this.anthropic = new sdk_1.default({
                apiKey: process.env.ANTHROPIC_API_KEY,
            });
        }
        // Initialize Ollama (for local development)
        if (process.env.OLLAMA_HOST) {
            this.ollama = new ollama_1.Ollama({
                host: process.env.OLLAMA_HOST,
            });
        }
    }
    async analyze(request) {
        const { prompt, model } = request;
        try {
            // Try OpenAI first (most reliable for production)
            if (this.openai && (this.provider === 'openai' || !this.provider)) {
                return await this.analyzeWithOpenAI(prompt, model);
            }
            // Try Anthropic as fallback
            if (this.anthropic && this.provider === 'anthropic') {
                return await this.analyzeWithAnthropic(prompt, model);
            }
            // Try Ollama as last resort (local only)
            if (this.ollama && this.provider === 'ollama') {
                return await this.analyzeWithOllama(prompt, model);
            }
            // Fallback to mock analysis if no AI service available
            return this.getMockAnalysis(prompt);
        }
        catch (error) {
            console.error('AI analysis failed:', error);
            return this.getMockAnalysis(prompt);
        }
    }
    async analyzeWithOpenAI(prompt, model) {
        const response = await this.openai.chat.completions.create({
            model: model || 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are a professional financial analyst. Provide concise, accurate market analysis based on the data provided. Focus on key drivers, technical indicators, and actionable insights.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 500,
            temperature: 0.3,
        });
        return {
            analysis: response.choices[0]?.message?.content || 'Analysis unavailable',
            provider: 'OpenAI',
            model: model || 'gpt-3.5-turbo'
        };
    }
    async analyzeWithAnthropic(prompt, model) {
        const response = await this.anthropic.messages.create({
            model: model || 'claude-3-haiku-20240307',
            max_tokens: 500,
            messages: [
                {
                    role: 'user',
                    content: `You are a professional financial analyst. Provide concise, accurate market analysis based on the data provided. Focus on key drivers, technical indicators, and actionable insights.

${prompt}`
                }
            ]
        });
        return {
            analysis: response.content[0]?.text || 'Analysis unavailable',
            provider: 'Anthropic',
            model: model || 'claude-3-haiku-20240307'
        };
    }
    async analyzeWithOllama(prompt, model) {
        const response = await this.ollama.generate({
            model: model || 'llama3.2:3b',
            prompt: `You are a professional financial analyst. Provide concise, accurate market analysis based on the data provided. Focus on key drivers, technical indicators, and actionable insights.

${prompt}`,
            options: {
                temperature: 0.3,
                num_predict: 500,
            }
        });
        return {
            analysis: response.response || 'Analysis unavailable',
            provider: 'Ollama',
            model: model || 'llama3.2:3b'
        };
    }
    getMockAnalysis(prompt) {
        // Generate a reasonable mock analysis based on the prompt
        const mockAnalyses = [
            "Based on the technical indicators and market data, this asset shows moderate volatility with mixed signals. The RSI indicates neutral momentum while volume patterns suggest normal trading activity. Consider monitoring key support and resistance levels for potential entry/exit points.",
            "Technical analysis reveals a balanced market position with no extreme overbought or oversold conditions. The MACD shows neutral momentum, and volume is within normal ranges. This suggests a wait-and-see approach may be prudent.",
            "Market data indicates stable conditions with technical indicators showing neither strong bullish nor bearish signals. Price action appears to be consolidating, which typically precedes a directional move. Monitor for breakout signals."
        ];
        const randomIndex = Math.floor(Math.random() * mockAnalyses.length);
        return {
            analysis: mockAnalyses[randomIndex],
            provider: 'Mock (No AI Service Available)',
            model: 'mock-v1'
        };
    }
    isAvailable() {
        return !!(this.openai || this.anthropic || this.ollama);
    }
    getProviderInfo() {
        if (this.openai)
            return 'OpenAI (Production Ready)';
        if (this.anthropic)
            return 'Anthropic (Production Ready)';
        if (this.ollama)
            return 'Ollama (Local Development)';
        return 'Mock Analysis (No AI Service)';
    }
}
exports.default = AIService;
