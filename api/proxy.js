const express = require('express');
const axios = require('axios');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Redis client - handle case where Redis isn't set up yet
let cache;
try {
    cache = require('./config/redis');
} catch (error) {
    console.warn('Redis not configured, using memory cache');
    // Simple in-memory cache fallback
    const memoryCache = new Map();
    cache = {
        get: async (key) => memoryCache.get(key),
        setex: async (key, ttl, value) => {
            memoryCache.set(key, value);
            setTimeout(() => memoryCache.delete(key), ttl * 1000);
        },
        del: async (key) => memoryCache.delete(key),
        keys: async (pattern) => {
            const keys = Array.from(memoryCache.keys());
            return keys.filter(k => k.includes(pattern.replace('*', '')));
        }
    };
}

// Track Alpha Vantage daily usage
let alphaVantageCallsToday = 0;
let alphaVantageResetDate = new Date().toDateString();

// Rate limiters
const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: 'Too many requests, please try again later'
});

const strictLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 5, // For Alpha Vantage endpoints
    message: 'Rate limit exceeded for this endpoint'
});

// Helper function to check Alpha Vantage daily limit
function checkAlphaVantageLimit() {
    const today = new Date().toDateString();
    if (today !== alphaVantageResetDate) {
        alphaVantageCallsToday = 0;
        alphaVantageResetDate = today;
    }
    
    if (alphaVantageCallsToday >= 25) {
        throw new Error('Alpha Vantage daily limit reached (25 calls)');
    }
    
    alphaVantageCallsToday++;
}

// Helper function to format responses
function formatStockData(ticker, data, source) {
    return {
        ticker: ticker.toUpperCase(),
        price: data.price || 0,
        change: data.change || 0,
        changePercent: data.changePercent || 0,
        high: data.high || 0,
        low: data.low || 0,
        previousClose: data.previousClose || 0,
        volume: data.volume || 0,
        marketCap: data.marketCap || 0,
        timestamp: new Date(),
        source: source,
        cached: false
    };
}

// Single stock quote
router.get('/stock/:ticker', generalLimiter, async (req, res) => {
    const { ticker } = req.params;
    const upperTicker = ticker.toUpperCase();
    
    try {
        // Check cache first
        const cacheKey = `stock:${upperTicker}`;
        const cached = await cache.get(cacheKey);
        if (cached) {
            const data = JSON.parse(cached);
            data.cached = true;
            return res.json(data);
        }

        // Try Finnhub first (better rate limits)
        try {
            const response = await axios.get('https://finnhub.io/api/v1/quote', {
                params: {
                    symbol: upperTicker,
                    token: process.env.FINNHUB_KEY
                },
                timeout: 5000
            });

            if (response.data && response.data.c !== null) {
                const data = formatStockData(upperTicker, {
                    price: response.data.c,
                    change: response.data.d,
                    changePercent: response.data.dp,
                    high: response.data.h,
                    low: response.data.l,
                    previousClose: response.data.pc,
                    volume: response.data.v
                }, 'finnhub');

                // Cache for 1 minute
                await cache.setex(cacheKey, 60, JSON.stringify(data));
                
                return res.json(data);
            }
        } catch (finnhubError) {
            console.error('Finnhub error:', finnhubError.message);
        }

        // Fallback to Alpha Vantage
        checkAlphaVantageLimit();
        
        const response = await axios.get('https://www.alphavantage.co/query', {
            params: {
                function: 'GLOBAL_QUOTE',
                symbol: upperTicker,
                apikey: process.env.ALPHA_VANTAGE_KEY
            },
            timeout: 10000
        });

        const quote = response.data['Global Quote'];
        if (!quote || Object.keys(quote).length === 0) {
            throw new Error('No data available for this ticker');
        }

        const data = formatStockData(upperTicker, {
            price: parseFloat(quote['05. price'] || 0),
            change: parseFloat(quote['09. change'] || 0),
            changePercent: parseFloat((quote['10. change percent'] || '0').replace('%', '')),
            high: parseFloat(quote['03. high'] || 0),
            low: parseFloat(quote['04. low'] || 0),
            previousClose: parseFloat(quote['08. previous close'] || 0),
            volume: parseInt(quote['06. volume'] || 0)
        }, 'alpha_vantage');

        // Cache for 5 minutes (Alpha Vantage data updates less frequently)
        await cache.setex(cacheKey, 300, JSON.stringify(data));
        
        res.json(data);

    } catch (error) {
        console.error('Stock fetch error:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch stock data',
            message: error.message,
            ticker: upperTicker
        });
    }
});

// Batch stock quotes
router.post('/stocks/batch', generalLimiter, async (req, res) => {
    const { tickers } = req.body;
    
    if (!Array.isArray(tickers) || tickers.length === 0) {
        return res.status(400).json({ error: 'Invalid tickers array' });
    }

    if (tickers.length > 50) {
        return res.status(400).json({ error: 'Maximum 50 tickers per request' });
    }

    try {
        const results = await Promise.all(
            tickers.map(async (ticker) => {
                const upperTicker = ticker.toUpperCase();
                
                // Check cache first
                const cached = await cache.get(`stock:${upperTicker}`);
                if (cached) {
                    const data = JSON.parse(cached);
                    data.cached = true;
                    return data;
                }

                // Fetch from Finnhub
                try {
                    const response = await axios.get('https://finnhub.io/api/v1/quote', {
                        params: {
                            symbol: upperTicker,
                            token: process.env.FINNHUB_KEY
                        },
                        timeout: 5000
                    });

                    if (response.data && response.data.c !== null) {
                        const data = formatStockData(upperTicker, {
                            price: response.data.c,
                            change: response.data.d,
                            changePercent: response.data.dp,
                            high: response.data.h,
                            low: response.data.l,
                            previousClose: response.data.pc,
                            volume: response.data.v
                        }, 'finnhub');

                        await cache.setex(`stock:${upperTicker}`, 60, JSON.stringify(data));
                        return data;
                    }
                } catch (error) {
                    console.error(`Error fetching ${upperTicker}:`, error.message);
                }

                return {
                    ticker: upperTicker,
                    error: 'Failed to fetch data'
                };
            })
        );

        res.json(results);

    } catch (error) {
        console.error('Batch fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch batch data' });
    }
});

// YieldMax ETF yields
router.get('/yieldmax/yields', generalLimiter, async (req, res) => {
    try {
        const cacheKey = 'yieldmax:yields';
        const cached = await cache.get(cacheKey);
        if (cached) {
            return res.json(JSON.parse(cached));
        }

        // YieldMax ETF tickers
        const yieldMaxTickers = [
            'MSTY', 'TSLY', 'NVDY', 'ULTY', 'OARK', 'APLY', 
            'GOOY', 'AMZY', 'NFLY', 'CONY', 'DISO', 'XOMO',
            'JPMO', 'AMDY', 'PYPY', 'FBY', 'MRNY', 'AIPY'
        ];

        // Fetch current prices for all YieldMax ETFs
        const results = await Promise.all(
            yieldMaxTickers.map(async (ticker) => {
                try {
                    const response = await axios.get('https://finnhub.io/api/v1/quote', {
                        params: {
                            symbol: ticker,
                            token: process.env.FINNHUB_KEY
                        },
                        timeout: 3000
                    });

                    return {
                        ticker,
                        price: response.data.c || 0,
                        change: response.data.d || 0,
                        changePercent: response.data.dp || 0,
                        // Yield data would need to come from another source
                        // This is placeholder data
                        yield: getEstimatedYield(ticker),
                        distribution: getLastDistribution(ticker)
                    };
                } catch (error) {
                    return {
                        ticker,
                        error: 'Failed to fetch data'
                    };
                }
            })
        );

        const data = {
            timestamp: new Date(),
            etfs: results.filter(r => !r.error)
        };

        // Cache for 5 minutes
        await cache.setex(cacheKey, 300, JSON.stringify(data));
        
        res.json(data);

    } catch (error) {
        console.error('YieldMax yields error:', error);
        res.status(500).json({ error: 'Failed to fetch YieldMax yields' });
    }
});

// Company profile
router.get('/company/:ticker', generalLimiter, async (req, res) => {
    const { ticker } = req.params;
    const upperTicker = ticker.toUpperCase();
    
    try {
        const cacheKey = `company:${upperTicker}`;
        const cached = await cache.get(cacheKey);
        if (cached) {
            return res.json(JSON.parse(cached));
        }

        // Try Finnhub company profile
        const response = await axios.get('https://finnhub.io/api/v1/stock/profile2', {
            params: {
                symbol: upperTicker,
                token: process.env.FINNHUB_KEY
            },
            timeout: 5000
        });

        if (!response.data || Object.keys(response.data).length === 0) {
            throw new Error('No company data available');
        }

        const data = {
            ticker: upperTicker,
            name: response.data.name,
            exchange: response.data.exchange,
            industry: response.data.finnhubIndustry,
            logo: response.data.logo,
            weburl: response.data.weburl,
            marketCap: response.data.marketCapitalization,
            shareOutstanding: response.data.shareOutstanding,
            country: response.data.country,
            currency: response.data.currency,
            ipo: response.data.ipo,
            timestamp: new Date()
        };

        // Cache for 1 hour
        await cache.setex(cacheKey, 3600, JSON.stringify(data));
        
        res.json(data);

    } catch (error) {
        console.error('Company profile error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch company profile',
            ticker: upperTicker 
        });
    }
});

// Market news
router.get('/news/:category?', generalLimiter, async (req, res) => {
    const category = req.params.category || 'general';
    
    try {
        const cacheKey = `news:${category}`;
        const cached = await cache.get(cacheKey);
        if (cached) {
            return res.json(JSON.parse(cached));
        }

        const response = await axios.get('https://finnhub.io/api/v1/news', {
            params: {
                category,
                token: process.env.FINNHUB_KEY
            },
            timeout: 5000
        });

        const data = {
            category,
            articles: response.data.slice(0, 20), // Limit to 20 articles
            timestamp: new Date()
        };

        // Cache for 15 minutes
        await cache.setex(cacheKey, 900, JSON.stringify(data));
        
        res.json(data);

    } catch (error) {
        console.error('News fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch news' });
    }
});

// Historical data (Alpha Vantage only)
router.get('/historical/:ticker/:range', strictLimiter, async (req, res) => {
    const { ticker, range } = req.params;
    const upperTicker = ticker.toUpperCase();
    
    try {
        const cacheKey = `historical:${upperTicker}:${range}`;
        const cached = await cache.get(cacheKey);
        if (cached) {
            return res.json(JSON.parse(cached));
        }

        checkAlphaVantageLimit();

        const functions = {
            '1D': 'TIME_SERIES_INTRADAY',
            '1W': 'TIME_SERIES_DAILY',
            '1M': 'TIME_SERIES_DAILY',
            '3M': 'TIME_SERIES_DAILY',
            '1Y': 'TIME_SERIES_DAILY'
        };

        const params = {
            function: functions[range] || 'TIME_SERIES_DAILY',
            symbol: upperTicker,
            apikey: process.env.ALPHA_VANTAGE_KEY
        };

        if (range === '1D') {
            params.interval = '5min';
        }

        const response = await axios.get('https://www.alphavantage.co/query', {
            params,
            timeout: 10000
        });

        // Process and limit data based on range
        const data = processHistoricalData(response.data, range);

        // Cache for different durations based on range
        const cacheDurations = {
            '1D': 300,    // 5 minutes
            '1W': 900,    // 15 minutes
            '1M': 1800,   // 30 minutes
            '3M': 3600,   // 1 hour
            '1Y': 7200    // 2 hours
        };

        await cache.setex(cacheKey, cacheDurations[range] || 1800, JSON.stringify(data));
        
        res.json(data);

    } catch (error) {
        console.error('Historical data error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch historical data',
            message: error.message 
        });
    }
});

// API status and limits
router.get('/status', async (req, res) => {
    const today = new Date().toDateString();
    
    res.json({
        status: 'healthy',
        timestamp: new Date(),
        limits: {
            alphaVantage: {
                used: alphaVantageCallsToday,
                limit: 25,
                resetDate: alphaVantageResetDate,
                remaining: Math.max(0, 25 - alphaVantageCallsToday)
            },
            finnhub: {
                limit: '60/minute',
                status: 'active'
            }
        },
        cache: {
            enabled: !!cache,
            type: cache.constructor.name === 'RedisClient' ? 'redis' : 'memory'
        }
    });
});

// Clear cache (admin endpoint - add authentication in production)
router.delete('/cache/:pattern?', async (req, res) => {
    const pattern = req.params.pattern || '*';
    
    try {
        const keys = await cache.keys(`*${pattern}*`);
        
        if (keys.length > 0) {
            await Promise.all(keys.map(key => cache.del(key)));
        }
        
        res.json({ 
            message: 'Cache cleared',
            keysDeleted: keys.length 
        });
        
    } catch (error) {
        console.error('Cache clear error:', error);
        res.status(500).json({ error: 'Failed to clear cache' });
    }
});

// Helper functions
function getEstimatedYield(ticker) {
    // This would be replaced with real yield data
    const yields = {
        'MSTY': 90.27,
        'TSLY': 98.54,
        'NVDY': 69.11,
        'ULTY': 42.33,
        'OARK': 67.78,
        'APLY': 34.21,
        'GOOY': 42.89,
        'AMZY': 38.12,
        'NFLY': 96.43,
        'CONY': 71.54,
        'DISO': 54.32,
        'XOMO': 61.78
    };
    
    return yields[ticker] || 0;
}

function getLastDistribution(ticker) {
    // This would be replaced with real distribution data
    return {
        amount: Math.random() * 2,
        exDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        payDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    };
}

function processHistoricalData(data, range) {
    // Extract and format time series data
    const timeSeries = data['Time Series (Daily)'] || 
                      data['Time Series (5min)'] || 
                      data['Time Series (Weekly)'] || 
                      data['Time Series (Monthly)'] || 
                      {};
    
    const entries = Object.entries(timeSeries);
    
    // Limit data points based on range
    const limits = {
        '1D': 78,    // ~6.5 hours of 5-min data
        '1W': 5,     // 5 days
        '1M': 22,    // ~1 month of trading days
        '3M': 65,    // ~3 months
        '1Y': 252    // ~1 year of trading days
    };
    
    const limited = entries.slice(0, limits[range] || 100);
    
    return {
        range,
        data: limited.map(([date, values]) => ({
            date,
            open: parseFloat(values['1. open']),
            high: parseFloat(values['2. high']),
            low: parseFloat(values['3. low']),
            close: parseFloat(values['4. close']),
            volume: parseInt(values['5. volume'])
        }))
    };
}

// Error handling middleware
router.use((err, req, res, next) => {
    console.error('API Error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

module.exports = router;