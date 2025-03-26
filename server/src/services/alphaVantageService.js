const axios = require('axios');

const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const BASE_URL = 'https://www.alphavantage.co/query';

if (!API_KEY) {
    console.warn('ALPHA_VANTAGE_API_KEY is not set in the environment variables. Alpha Vantage API calls will fail.');
}

// Helper function for making API calls and basic error checks
const makeApiCall = async (params) => {
    if (!API_KEY) {
        throw new Error('Alpha Vantage API key is missing.');
    }
    if (!params.symbol) {
        throw new Error('Stock symbol is required.');
    }

    try {
        const response = await axios.get(BASE_URL, { params: { ...params, apikey: API_KEY } });

        if (response.data['Error Message']) {
            throw new Error(`Alpha Vantage API Error: ${response.data['Error Message']}`);
        }
        if (response.data['Note']) {
            // Log note but don't treat as error unless it indicates rate limit explicitly
            console.warn(`Alpha Vantage API Note: ${response.data['Note']}`);
        }
        // Check if the expected data key exists (e.g., 'Technical Analysis: EMA', 'Time Series (Daily)')
        const dataKeys = Object.keys(response.data).filter(key => key.startsWith('Technical Analysis:') || key.startsWith('Time Series'));
        if (dataKeys.length === 0) {
             throw new Error(`No data found or unexpected response format for function ${params.function} and symbol ${params.symbol}`);
        }

        return response.data;

    } catch (error) {
        // Log the specific error from this function context
        console.error(`Error in makeApiCall for ${params.function} on ${params.symbol}:`, error.message);
        // Re-throw the error to be handled by the calling function (e.g., fetchDailyTimeSeries)
        throw error;
    }
};

/**
 * Fetches daily time series data (adjusted close, volume, etc.) for a given stock symbol.
 * @param {string} symbol The stock symbol (e.g., 'IBM', 'TSLA').
 * @param {string} [outputsize='compact'] 'compact' for last 100 points, 'full' for full history.
 * @returns {Promise<object>} A promise that resolves with the time series data or rejects with an error.
 */
const fetchDailyTimeSeries = async (symbol, outputsize = 'compact') => {
    const params = {
        function: 'TIME_SERIES_DAILY_ADJUSTED',
        symbol: symbol,
        outputsize: outputsize
    };
    return makeApiCall(params);
};

// --- Technical Indicator Functions ---

/**
 * Fetches Exponential Moving Average (EMA) data for a given stock symbol.
 * @param {string} symbol The stock symbol.
 * @param {number} time_period The time period for the EMA (e.g., 10, 20, 50).
 * @param {string} [interval='daily'] The time interval (e.g., '1min', '5min', '15min', '30min', '60min', 'daily', 'weekly', 'monthly').
 * @param {string} [series_type='close'] The price type to use (e.g., 'close', 'open', 'high', 'low').
 * @returns {Promise<object>} A promise that resolves with the EMA data.
 */
const fetchEMA = async (symbol, time_period, interval = 'daily', series_type = 'close') => {
    const params = {
        function: 'EMA',
        symbol: symbol,
        interval: interval,
        time_period: time_period,
        series_type: series_type
    };
    return makeApiCall(params);
};

/**
 * Fetches Relative Strength Index (RSI) data for a given stock symbol.
 * @param {string} symbol The stock symbol.
 * @param {number} time_period The time period for the RSI (e.g., 14).
 * @param {string} [interval='daily'] The time interval.
 * @param {string} [series_type='close'] The price type to use.
 * @returns {Promise<object>} A promise that resolves with the RSI data.
 */
const fetchRSI = async (symbol, time_period, interval = 'daily', series_type = 'close') => {
    const params = {
        function: 'RSI',
        symbol: symbol,
        interval: interval,
        time_period: time_period,
        series_type: series_type
    };
    return makeApiCall(params);
};

/**
 * Fetches Stochastic Oscillator (STOCH) data for a given stock symbol.
 * Note: This is STOCH, not StochRSI. StochRSI might require separate calculation or a different API endpoint if available.
 * @param {string} symbol The stock symbol.
 * @param {string} [interval='daily'] The time interval.
 * @param {number} [fastkperiod=5] Fast %K period.
 * @param {number} [slowkperiod=3] Slow %K period.
 * @param {number} [slowdperiod=3] Slow %D period.
 * @param {string} [slowkmatype='SMA'] Type of Moving Average for Slow %K (0=SMA, 1=EMA, etc.).
 * @param {string} [slowdmatype='SMA'] Type of Moving Average for Slow %D.
 * @returns {Promise<object>} A promise that resolves with the STOCH data.
 */
const fetchStoch = async (symbol, interval = 'daily', fastkperiod = 5, slowkperiod = 3, slowdperiod = 3, slowkmatype = 0, slowdmatype = 0) => {
    const params = {
        function: 'STOCH',
        symbol: symbol,
        interval: interval,
        fastkperiod: fastkperiod,
        slowkperiod: slowkperiod,
        slowdperiod: slowdperiod,
        slowkmatype: slowkmatype, // Alpha Vantage uses numbers for MA type in STOCH
        slowdmatype: slowdmatype
    };
    return makeApiCall(params);
};


module.exports = {
    fetchDailyTimeSeries,
    fetchEMA,
    fetchRSI,
    fetchStoch
};