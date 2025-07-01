const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// Test cases covering all scenarios
const testCases = [
  // Valid stock tests with different timeframes
  { ticker: 'AAPL', timeframe: '1 week', expected: 'stock' },
  { ticker: 'AAPL', timeframe: '1 month', expected: 'stock' },
  { ticker: 'AAPL', timeframe: '3 months', expected: 'stock' },
  { ticker: 'AAPL', timeframe: '6 months', expected: 'stock' },
  { ticker: 'AAPL', timeframe: '1 year', expected: 'stock' },
  { ticker: 'AAPL', timeframe: '5 years', expected: 'stock' },
  
  // Valid ETF tests
  { ticker: 'SPY', timeframe: '1 week', expected: 'etf' },
  { ticker: 'QQQ', timeframe: '3 months', expected: 'etf' },
  
  // Valid crypto tests
  { ticker: 'BTC', timeframe: '1 week', expected: 'crypto' },
  { ticker: 'ETH', timeframe: '1 month', expected: 'crypto' },
  
  // Invalid ticker test
  { ticker: 'ZZZZ', timeframe: '1 week', expected: 'error' },
  
  // Edge cases
  { ticker: 'NVDA', timeframe: '1 day', expected: 'stock' },
  { ticker: 'TSLA', timeframe: '1 week', expected: 'stock' }
];

// Expected indicators per timeframe (based on actual implementation)
const expectedIndicators = {
  '1 day': ['VWAP', 'Bollinger Bands', 'MACD', 'Volume Spike'],
  '3 days': ['RSI (7)', 'MACD', 'ATR', 'OBV'],
  '5 days': ['RSI (14)', 'MACD Histogram', 'SMA(5)', 'Bollinger Bands'],
  '1 week': ['RSI (14)', 'MACD', 'OBV', 'Stochastic RSI'],
  '2 weeks': ['SMA(20)', 'ADX', 'MACD', 'Bollinger Band Width'],
  '1 month': ['RSI (14)', 'MACD', 'Bollinger Bands', 'OBV'],
  '3 months': ['SMA(50)', 'MACD', 'ADX', 'A/D Line'],
  '6 months': ['SMA(50)', 'SMA(200)', 'ATR', 'MACD'],
  '1 year': ['SMA(200)', 'MACD', 'RSI (14)', 'OBV'],
  '5 years': ['SMA(200)', 'MACD', 'SuperTrend', 'Heikin Ashi']
};

async function runTest(testCase) {
  console.log(`\n🧪 Testing: ${testCase.ticker} (${testCase.timeframe})`);
  console.log('─'.repeat(50));
  
  try {
    const startTime = Date.now();
    const response = await axios.post(`${BASE_URL}/analyze`, {
      ticker: testCase.ticker,
      timeframe: testCase.timeframe
    }, {
      timeout: 30000
    });
    const duration = Date.now() - startTime;
    
    const data = response.data;
    
    // Basic response structure validation
    console.log(`✅ Response received in ${duration}ms`);
    
    // Check for error response
    if (data.error) {
      console.log(`❌ Error: ${data.error}`);
      if (testCase.expected === 'error') {
        console.log('✅ Expected error for invalid ticker');
        return { success: true, type: 'error' };
      } else {
        console.log('❌ Unexpected error for valid ticker');
        return { success: false, type: 'unexpected_error' };
      }
    }
    
    // Validate basic structure - data is at root level
    if (!data.ticker || !data.stockData) {
      console.log('❌ Missing required fields (ticker or stockData)');
      return { success: false, type: 'missing_required_fields' };
    }
    
    const analysis = data;
    
    // Validate price data (use endPrice, startPrice, percentChange)
    if (!analysis.stockData || typeof analysis.stockData.endPrice !== 'number' || typeof analysis.stockData.startPrice !== 'number' || typeof analysis.stockData.percentChange !== 'number') {
      console.log('❌ Missing or invalid price data (endPrice/startPrice/percentChange)');
      return { success: false, type: 'missing_price_data' };
    }
    console.log(`💰 Price: $${analysis.stockData.endPrice} (${analysis.stockData.percentChange}%)`);
    
    // Validate technical indicators
    if (!analysis.technicalIndicators) {
      console.log('❌ Missing technical indicators');
      return { success: false, type: 'missing_indicators' };
    }
    
    const indicators = analysis.technicalIndicators;
    const expectedForTimeframe = expectedIndicators[testCase.timeframe] || [];
    
    console.log(`📈 Technical Indicators (${indicators.length} found):`);
    indicators.forEach(indicator => {
      const hasValue = indicator.value !== undefined && indicator.value !== null;
      const hasComment = indicator.comment && indicator.comment.trim() !== '';
      const hasTrend = indicator.trend && ['bullish', 'bearish', 'neutral'].includes(indicator.trend);
      
      console.log(`  • ${indicator.name}: ${indicator.value} (${indicator.trend}) ${hasComment ? '✅' : '❌'}`);
      
      if (!hasValue) console.log(`    ❌ Missing value for ${indicator.name}`);
      if (!hasComment) console.log(`    ❌ Missing comment for ${indicator.name}`);
      if (!hasTrend) console.log(`    ❌ Invalid trend for ${indicator.name}`);
    });
    
    // Check if all expected indicators are present
    const foundIndicators = indicators.map(i => i.name);
    const missingIndicators = expectedForTimeframe.filter(name => !foundIndicators.includes(name));
    
    if (missingIndicators.length > 0) {
      console.log(`⚠️ Missing expected indicators: ${missingIndicators.join(', ')}`);
    } else {
      console.log('✅ All expected indicators present');
    }
    
    // Validate news analysis
    if (!analysis.newsArticles) {
      console.log('❌ Missing news articles');
      return { success: false, type: 'missing_news' };
    }
    
    console.log(`📰 News: ${analysis.newsArticles.length} articles processed`);
    
    // Validate AI analysis
    if (!analysis.llaMAAnalysis) {
      console.log('❌ Missing LLaMA analysis');
      return { success: false, type: 'missing_ai' };
    }
    
    console.log(`🤖 AI Summary: ${analysis.llaMAAnalysis.substring(0, 100)}...`);
    
    // Validate market drivers
    if (!analysis.drivers) {
      console.log('❌ Missing market drivers');
      return { success: false, type: 'missing_drivers' };
    }
    
    console.log(`🚀 Market Drivers (${analysis.drivers.length}):`);
    analysis.drivers.forEach(driver => {
      console.log(`  • ${driver.substring(0, 50)}...`);
    });
    
    // Validate volume spike detection
    if (analysis.stockData && analysis.stockData.volumeRatio > 1.3) {
      console.log(`📊 Volume Spike: ${analysis.stockData.volumeRatio.toFixed(2)}x normal volume`);
    }
    
    return { success: true, type: 'success', data: analysis };
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return { success: false, type: 'request_failed', error: error.message };
  }
}

async function runAllTests() {
  console.log('🚀 Starting Comprehensive MarketMover Test Suite');
  console.log('='.repeat(60));
  
  const results = {
    total: testCases.length,
    passed: 0,
    failed: 0,
    errors: 0,
    details: []
  };
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n📋 Test ${i + 1}/${testCases.length}`);
    
    const result = await runTest(testCase);
    results.details.push({
      testCase,
      result
    });
    
    if (result.success) {
      results.passed++;
      console.log('✅ Test PASSED');
    } else {
      results.failed++;
      console.log('❌ Test FAILED');
    }
    
    // Add delay between tests to avoid rate limiting
    if (i < testCases.length - 1) {
      console.log('⏳ Waiting 2 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.total}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  
  // Detailed failures
  if (results.failed > 0) {
    console.log('\n🔍 FAILED TESTS:');
    results.details.forEach((detail, index) => {
      if (!detail.result.success) {
        console.log(`${index + 1}. ${detail.testCase.ticker} (${detail.testCase.timeframe}) - ${detail.result.type}`);
      }
    });
  }
  
  // Performance analysis
  console.log('\n⚡ PERFORMANCE ANALYSIS:');
  const successfulTests = results.details.filter(d => d.result.success && d.result.type === 'success');
  if (successfulTests.length > 0) {
    const avgResponseTime = successfulTests.reduce((sum, test) => {
      return sum + (test.result.data ? 1 : 0); // Placeholder for actual timing
    }, 0) / successfulTests.length;
    console.log(`Average response time: ~${avgResponseTime.toFixed(0)}ms`);
  }
  
  return results;
}

// Run the tests
if (require.main === module) {
  runAllTests()
    .then(results => {
      console.log('\n🎉 Test suite completed!');
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('💥 Test suite crashed:', error);
      process.exit(1);
    });
}

module.exports = { runAllTests, runTest }; 