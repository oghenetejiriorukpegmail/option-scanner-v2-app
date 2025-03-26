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

// Placeholder for future scanner endpoint
app.get('/api/scan', (req, res) => {
  // TODO: Implement scanner logic based on query parameters
  res.status(501).json({ message: 'Scanner endpoint not yet implemented.' });
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