const axios = require('axios');

const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const BASE_URL = 'https://www.alphavantage.co/query';

if (!API_KEY) {
    console.warn('ALPHA_VANTAGE_API_KEY is not set in the environment variables. Alpha Vantage API calls will fail.');
}

/**
 * Fetches daily time series data (adjusted close, volume, etc.) for a given stock symbol.
 * @param {string} symbol The stock symbol (e.g., 'IBM', 'TSLA').
 * @returns {Promise<object>} A promise that resolves with the time series data or rejects with an error.
 */
const fetchDailyTimeSeries = async (symbol) => {
    if (!API_KEY) {
        return Promise.reject(new Error('Alpha Vantage API key is missing.'));
    }
    if (!symbol) {
        return Promise.reject(new Error('Stock symbol is required.'));
    }

    try {
        const response = await axios.get(BASE_URL, {
            params: {
                function: 'TIME_SERIES_DAILY_ADJUSTED',
                symbol: symbol,
                apikey: API_KEY,
                outputsize: 'compact' // 'compact' for last 100 days, 'full' for full history
            }
        });

        // Basic error handling for Alpha Vantage API responses
        if (response.data['Error Message']) {
            throw new Error(`Alpha Vantage API Error: ${response.data['Error Message']}`);
        }
        if (response.data['Note']) {
            console.warn(`Alpha Vantage API Note: ${response.data['Note']}`);
            // Potentially handle rate limiting note here if needed
        }
        if (!response.data['Time Series (Daily)']) {
             throw new Error(`No daily time series data found for symbol: ${symbol}`);
        }


        return response.data; // Return the full response object for now

    } catch (error) {
        console.error(`Error fetching daily time series for ${symbol}:`, error.message);
        // Rethrow or handle error appropriately
        throw error;
    }
};

module.exports = {
    fetchDailyTimeSeries
};