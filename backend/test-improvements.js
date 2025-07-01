const axios = require('axios');

// Test cases to verify all improvements
const testCases = [
  { ticker: 'AAPL', timeframe: '1 week', description: 'Stock with normal volume' },
  { ticker: 'NVDA', timeframe: '1 day', description: 'Stock with potential volume spike' },
  { ticker: 'BTC', timeframe: '1 week', description: 'Crypto with technical indicators' },
  { ticker: 'ETH', timeframe: '3 months', description: 'Crypto with longer timeframe' },
  { ticker: 'ZZZZ', timeframe: '1 week', description: 'Invalid ticker error handling' }
];

async function testImprovements() {
  console.log('🧪 Testing MarketMover Technical Indicator Improvements\n');
  
  for (const testCase of testCases) {
    console.log(`\n📊 Testing: ${testCase.ticker} (${testCase.timeframe}) - ${testCase.description}`);
    console.log('─'.repeat(80));
    
    try {
      const response = await axios.post('http://localhost:3001/analyze', {
        ticker: testCase.ticker,
        timeframe: testCase.timeframe
      });
      
      const data = response.data;
      
      // Test 1: Error handling for invalid tickers
      if (data.error) {
        console.log(`✅ Error Handling: ${data.error}`);
        console.log(`✅ Suggestion: ${data.suggestion}`);
        continue;
      }
      
      // Test 2: Technical indicators with comments
      console.log(`\n📈 Technical Indicators (${data.technicalIndicators.length} total):`);
      data.technicalIndicators.forEach((indicator, index) => {
        console.log(`  ${index + 1}. ${indicator.name}: ${indicator.value} → ${indicator.signal}`);
        if (indicator.comment) {
          console.log(`     💬 ${indicator.comment}`);
        }
      });
      
      // Test 3: Volume spike detection (should only appear if meaningful)
      const volumeSpike = data.technicalIndicators.find(i => i.name === 'Volume Spike');
      if (volumeSpike) {
        console.log(`\n🔊 Volume Spike Detected: ${volumeSpike.value} (${volumeSpike.comment})`);
      } else {
        console.log(`\n🔊 Volume Spike: Not detected (volume ratio: ${data.stockData.volumeRatio.toFixed(2)}x)`);
      }
      
      // Test 4: Driver categorization
      console.log(`\n🎯 Drivers (${data.drivers.length} total):`);
      data.drivers.forEach((driver, index) => {
        console.log(`  ${index + 1}. ${driver}`);
      });
      
      // Test 5: Technical context in LLaMA analysis
      console.log(`\n🤖 LLaMA Analysis Preview:`);
      const analysisPreview = data.llaMAAnalysis.substring(0, 200) + '...';
      console.log(`  ${analysisPreview}`);
      
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
    }
  }
  
  console.log('\n🎉 All tests completed!');
}

// Run the tests
testImprovements().catch(console.error); 