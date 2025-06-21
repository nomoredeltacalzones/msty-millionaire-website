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
    const cacheKey = `company:${upperTicker}`;

    try {
        const cached = await cache.get(cacheKey);
        if (cached) return res.json(JSON.parse(cached));

        const response = await axios.get('https://finnhub.io/api/v1/stock/profile2', {
            params: { symbol: upperTicker, token: process.env.FINNHUB_KEY }
        });

        await cache.setex(cacheKey, 86400, JSON.stringify(response.data)); // Cache for 24 hours
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch company profile' });
    }
});

// Historical data (candles)
router.get('/historical/:ticker', generalLimiter, async (req, res) => {
    const { ticker } = req.params;
    const { resolution = 'D', days = 365 } = req.query; // 'D' for daily, 'W' for weekly, 'M' for monthly
    const upperTicker = ticker.toUpperCase();
    const cacheKey = `historical:${upperTicker}:${resolution}:${days}`;
    
    try {
        const cached = await cache.get(cacheKey);
        if (cached) return res.json(JSON.parse(cached));

        const to = Math.floor(Date.now() / 1000);
        const from = to - (days * 24 * 60 * 60);

        const response = await axios.get('https://finnhub.io/api/v1/stock/candle', {
            params: {
                symbol: upperTicker,
                resolution,
                from,
                to,
                token: process.env.FINNHUB_KEY
            }
        });

        await cache.setex(cacheKey, 3600, JSON.stringify(response.data)); // Cache for 1 hour
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch historical data' });
    }
});

// Company news
router.get('/news/:ticker', generalLimiter, async (req, res) => {
    const { ticker } = req.params;
    const upperTicker = ticker.toUpperCase();
    const cacheKey = `news:${upperTicker}`;

    try {
        const cached = await cache.get(cacheKey);
        if (cached) return res.json(JSON.parse(cached));

        const to = new Date().toISOString().slice(0, 10);
        const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); // 30 days ago

        const response = await axios.get('https://finnhub.io/api/v1/company-news', {
            params: {
                symbol: upperTicker,
                from,
                to,
                token: process.env.FINNHUB_KEY
            }
        });
        
        const news = response.data.slice(0, 10); // Limit to 10 articles
        await cache.setex(cacheKey, 3600, JSON.stringify(news)); // Cache for 1 hour
        res.json(news);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch company news' });
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

// Error handling middleware
router.use((err, req, res, next) => {
    console.error('API Error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

module.exports = router;
