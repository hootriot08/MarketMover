const yahooFinance = require('yfinance');

async function testYFinance() {
  try {
    console.log('Testing yfinance...');
    console.log('YahooFinance object:', yahooFinance);
    
    // Try different ways to access the API
    if (yahooFinance.default) {
      console.log('Using yahooFinance.default');
      const ticker = yahooFinance.default.Ticker('AAPL');
      const history = await ticker.history({ period: '1d' });
      console.log('History:', history);
    } else if (yahooFinance.Ticker) {
      console.log('Using yahooFinance.Ticker');
      const ticker = yahooFinance.Ticker('AAPL');
      const history = await ticker.history({ period: '1d' });
      console.log('History:', history);
    } else {
      console.log('Available methods:', Object.keys(yahooFinance));
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testYFinance(); 