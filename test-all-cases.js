const axios = require('axios');

// Test cases to run
const testCases = [
  { ticker: 'AAPL', timeframe: '1 day' },
  { ticker: 'AAPL', timeframe: '1 week' },
  { ticker: 'AAPL', timeframe: '1 year' },
  { ticker: 'NVDA', timeframe: '1 week' },
  { ticker: 'SPY', timeframe: '1 month' },
  { ticker: 'BTC', timeframe: '1 week' },
  { ticker: 'ETH', timeframe: '3 months' },
  { ticker: 'ZZZZ', timeframe: '1 week' }, // Invalid ticker
  { ticker: 'SMCI', timeframe: '1 day' }, // Edge case
  { ticker: 'BTC', timeframe: '5 years' }, // Crypto long timeframe
  { ticker: 'AAPL', timeframe: '3 months' },
  { ticker: 'NVDA', timeframe: '5 years' },
  { ticker: 'SPY', timeframe: '6 months' }
];

async function runTest(testCase) {
  console.log(`\n🧪 Testing: ${testCase.ticker} - ${testCase.timeframe}`);
  
  try {
    const response = await axios.post('http://localhost:3001/analyze', testCase, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return {
      testCase,
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      testCase,
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

async function runAllTests() {
  console.log('🚀 Starting comprehensive MarketMover API tests...');
  console.log(`📊 Running ${testCases.length} test cases...`);
  
  const results = [];
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n[${i + 1}/${testCases.length}] Testing ${testCase.ticker} - ${testCase.timeframe}`);
    
    const result = await runTest(testCase);
    results.push(result);
    
    // Add delay between requests to avoid rate limiting
    if (i < testCases.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Generate comprehensive report
  const report = generateReport(results);
  
  // Save to file
  const fs = require('fs');
  fs.writeFileSync('comprehensive-test-results.json', JSON.stringify(results, null, 2));
  fs.writeFileSync('comprehensive-test-report.md', report);
  
  console.log('\n✅ All tests completed!');
  console.log('📁 Results saved to:');
  console.log('   - comprehensive-test-results.json (raw data)');
  console.log('   - comprehensive-test-report.md (formatted report)');
  
  return results;
}

function generateReport(results) {
  let report = `# MarketMover API Comprehensive Test Results\n\n`;
  report += `**Test Date:** ${new Date().toLocaleString()}\n`;
  report += `**Total Tests:** ${results.length}\n`;
  report += `**Successful:** ${results.filter(r => r.success).length}\n`;
  report += `**Failed:** ${results.filter(r => !r.success).length}\n\n`;
  
  report += `## Summary\n\n`;
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  if (successful.length > 0) {
    report += `### ✅ Successful Tests (${successful.length})\n\n`;
    successful.forEach((result, index) => {
      const data = result.data;
      report += `${index + 1}. **${data.ticker}** - ${data.timeframe}\n`;
      report += `   - Asset Type: ${data.assetType}\n`;
      report += `   - Price Change: ${data.stockData?.percentChange}%\n`;
      report += `   - Technical Indicators: ${data.technicalIndicators?.length || 0}\n`;
      report += `   - News Articles: ${data.newsArticles?.length || 0}\n`;
      report += `   - Drivers: ${data.drivers?.length || 0}\n\n`;
    });
  }
  
  if (failed.length > 0) {
    report += `### ❌ Failed Tests (${failed.length})\n\n`;
    failed.forEach((result, index) => {
      report += `${index + 1}. **${result.testCase.ticker}** - ${result.testCase.timeframe}\n`;
      report += `   - Error: ${result.error}\n\n`;
    });
  }
  
  report += `## Detailed Results\n\n`;
  
  results.forEach((result, index) => {
    report += `### Test ${index + 1}: ${result.testCase.ticker} - ${result.testCase.timeframe}\n\n`;
    report += `**Timestamp:** ${result.timestamp}\n\n`;
    
    if (result.success) {
      const data = result.data;
      report += `**Status:** ✅ Success\n\n`;
      report += `**Response Data:**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n\n`;
    } else {
      report += `**Status:** ❌ Failed\n\n`;
      report += `**Error:** ${result.error}\n\n`;
    }
    
    report += `---\n\n`;
  });
  
  return report;
}

// Run the tests
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests, runTest }; 