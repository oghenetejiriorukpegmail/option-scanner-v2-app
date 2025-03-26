const express = require('express');
require('dotenv').config(); // Load environment variables from .env file
const alphaVantageService = require('./src/services/alphaVantageService'); // Import the service

const app = express();
const PORT = process.env.PORT || 3001; // Use environment variable or default to 3001

// Middleware for parsing JSON bodies (optional for now, but good practice)
app.use(express.json());

// --- API Routes ---

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// --- Helper function to get the latest value from Alpha Vantage technical indicator data ---
const getLatestIndicatorValue = (data, indicatorKeyPrefix) => {
  const analysisKey = Object.keys(data).find(key => key.startsWith(indicatorKeyPrefix));
  if (!analysisKey || !data[analysisKey]) {
    // console.warn(`Indicator key prefix "${indicatorKeyPrefix}" not found or data is empty.`);
    return null;
  }
  const timeSeries = data[analysisKey];
  const latestDate = Object.keys(timeSeries).sort().reverse()[0]; // Get the most recent date string
  if (!latestDate || !timeSeries[latestDate]) {
    // console.warn(`No latest date or data found for indicator "${indicatorKeyPrefix}".`);
    return null;
  }
  // The actual value is usually nested under a key like 'EMA', 'RSI', 'SlowK'/'SlowD'
  const valueKey = Object.keys(timeSeries[latestDate])[0];
  return parseFloat(timeSeries[latestDate][valueKey]);
};

// --- Scanner Endpoint ---
app.get('/api/scan', async (req, res) => {
  const { symbols, setupType = 'bullish' } = req.query;

  if (!symbols) {
    return res.status(400).json({ error: 'Query parameter "symbols" (comma-separated) is required.' });
  }

  const symbolList = symbols.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
  if (symbolList.length === 0) {
    return res.status(400).json({ error: 'No valid symbols provided.' });
  }

  console.log(`Scanning symbols: ${symbolList.join(', ')} for setup type: ${setupType}`);
  const results = [];
  const errors = [];

  // Process symbols concurrently
  await Promise.all(symbolList.map(async (symbol) => {
    try {
      // Fetch required indicators concurrently for the current symbol
      const [ema10Data, ema20Data, ema50Data, rsiData, stochData /*, optionsData */] = await Promise.all([
        alphaVantageService.fetchEMA(symbol, 10),
        alphaVantageService.fetchEMA(symbol, 20),
        alphaVantageService.fetchEMA(symbol, 50),
        alphaVantageService.fetchRSI(symbol, 14),
        alphaVantageService.fetchStoch(symbol) // Using default STOCH settings
        // TODO: Fetch options data (PCR, GEX, OI, etc.) from a suitable provider
        // Promise.resolve({}) // Placeholder for options data
      ]);

      // Extract latest values
      const ema10 = getLatestIndicatorValue(ema10Data, 'Technical Analysis: EMA');
      const ema20 = getLatestIndicatorValue(ema20Data, 'Technical Analysis: EMA');
      const ema50 = getLatestIndicatorValue(ema50Data, 'Technical Analysis: EMA');
      const rsi = getLatestIndicatorValue(rsiData, 'Technical Analysis: RSI');
      const stochK = getLatestIndicatorValue(stochData, 'Technical Analysis: STOCH'); // Gets SlowK by default structure
      // const stochD = getLatestIndicatorValue(stochData, 'Technical Analysis: STOCH', 'SlowD'); // Need to adjust helper if needed

      // TODO: Extract options metrics (pcr, gex, iv, etc.) from optionsData

      // --- Apply Filtering Logic based on PRD (using available data) ---
      let match = false;
      if (ema10 === null || ema20 === null || ema50 === null || rsi === null || stochK === null) {
         console.warn(`Skipping ${symbol} due to missing indicator data.`);
         // Optionally add to errors list
         // errors.push({ symbol, message: 'Missing indicator data' });
         return; // Skip this symbol if essential data is missing
      }

      switch (setupType.toLowerCase()) {
        case 'bullish':
          // Trend: EMA 10 > 20 > 50
          const isBullishTrend = ema10 > ema20 && ema20 > ema50;
          // Momentum: RSI 55-80, Stoch > 60 (Using StochK as proxy for StochRSI)
          const isBullishMomentum = rsi >= 55 && rsi <= 80 && stochK > 60;
          // TODO: Add PCR < threshold filter
          // TODO: Add GEX > threshold filter
          match = isBullishTrend && isBullishMomentum;
          break;

        case 'bearish':
          // Trend: EMA 10 < 20 < 50
          const isBearishTrend = ema10 < ema20 && ema20 < ema50;
          // Momentum: RSI 20-45, Stoch < 40 (Using StochK as proxy for StochRSI)
          const isBearishMomentum = rsi >= 20 && rsi <= 45 && stochK < 40;
          // TODO: Add PCR > threshold filter
          // TODO: Add GEX < threshold filter
          match = isBearishTrend && isBearishMomentum;
          break;

        case 'neutral':
          // Trend: EMAs converging (approximate check: % diff < 1%)
          const avgEma = (ema10 + ema20 + ema50) / 3;
          const isNeutralTrend =
            Math.abs(ema10 - avgEma) / avgEma < 0.01 &&
            Math.abs(ema20 - avgEma) / avgEma < 0.01 &&
            Math.abs(ema50 - avgEma) / avgEma < 0.01;
          // Momentum: RSI 45-65, Stoch 25-75 (Using StochK as proxy for StochRSI)
          const isNeutralMomentum = rsi >= 45 && rsi <= 65 && stochK >= 25 && stochK <= 75;
          // TODO: Add PCR ~ 1 filter
          // TODO: Add IV < threshold filter
          // TODO: Add Price near Max Pain filter
          match = isNeutralTrend && isNeutralMomentum;
          break;

        default:
          errors.push({ symbol: 'N/A', message: `Invalid setupType: ${setupType}` });
          // This error applies to the whole request, maybe handle differently
          return; // Stop processing if setupType is invalid? Or just skip filtering?
      }

      if (match) {
        results.push({
            symbol: symbol,
            ema10: ema10,
            ema20: ema20,
            ema50: ema50,
            rsi: rsi,
            stochK: stochK,
            // TODO: Add relevant options data here
        });
      }

    } catch (error) {
      console.error(`Error processing symbol ${symbol}:`, error.message);
      errors.push({ symbol: symbol, message: error.message });
    }
  })); // End Promise.all for symbols

  // Send response
  res.status(200).json({
    scanParameters: { symbols: symbolList, setupType },
    matches: results,
    errors: errors
  });
});

// Endpoint to get daily stock data for a symbol
app.get('/api/stocks/:symbol/daily', async (req, res) => {
  const symbol = req.params.symbol;
  if (!symbol) {
    return res.status(400).json({ error: 'Stock symbol parameter is required.' });
  }

  try {
    // Ensure symbol is uppercase as Alpha Vantage often expects it
    const data = await alphaVantageService.fetchDailyTimeSeries(symbol.toUpperCase());
    res.status(200).json(data);
  } catch (error) {
    // Log the detailed error on the server
    console.error(`Error in /api/stocks/${symbol}/daily:`, error);
    // Send a generic error message to the client, including specific details if available
    res.status(500).json({ error: 'Failed to fetch stock data.', details: error.message });
  }
});

// --- Technical Indicator Endpoints ---

// Endpoint for EMA
app.get('/api/stocks/:symbol/ema', async (req, res) => {
  const symbol = req.params.symbol?.toUpperCase();
  const {
    time_period = 10, // Default to 10 period
    interval = 'daily',
    series_type = 'close'
  } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Stock symbol parameter is required.' });
  }

  try {
    const data = await alphaVantageService.fetchEMA(symbol, parseInt(time_period), interval, series_type);
    res.status(200).json(data);
  } catch (error) {
    console.error(`Error fetching EMA for ${symbol}:`, error);
    res.status(500).json({ error: 'Failed to fetch EMA data.', details: error.message });
  }
});

// Endpoint for RSI
app.get('/api/stocks/:symbol/rsi', async (req, res) => {
  const symbol = req.params.symbol?.toUpperCase();
  const {
    time_period = 14, // Default to 14 period
    interval = 'daily',
    series_type = 'close'
  } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Stock symbol parameter is required.' });
  }

  try {
    const data = await alphaVantageService.fetchRSI(symbol, parseInt(time_period), interval, series_type);
    res.status(200).json(data);
  } catch (error) {
    console.error(`Error fetching RSI for ${symbol}:`, error);
    res.status(500).json({ error: 'Failed to fetch RSI data.', details: error.message });
  }
});

// Endpoint for STOCH
app.get('/api/stocks/:symbol/stoch', async (req, res) => {
  const symbol = req.params.symbol?.toUpperCase();
  const {
    interval = 'daily',
    fastkperiod = 5,
    slowkperiod = 3,
    slowdperiod = 3,
    slowkmatype = 0, // SMA default
    slowdmatype = 0  // SMA default
  } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Stock symbol parameter is required.' });
  }

  try {
    const data = await alphaVantageService.fetchStoch(
      symbol,
      interval,
      parseInt(fastkperiod),
      parseInt(slowkperiod),
      parseInt(slowdperiod),
      parseInt(slowkmatype),
      parseInt(slowdmatype)
    );
    res.status(200).json(data);
  } catch (error) {
    console.error(`Error fetching STOCH for ${symbol}:`, error);
    res.status(500).json({ error: 'Failed to fetch STOCH data.', details: error.message });
  }
});


// --- Server Start ---

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});