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

// --- Server Start ---

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});