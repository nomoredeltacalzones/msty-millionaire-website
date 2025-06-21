// ================================================
// COMPLETE GUIDE TO PULLING STOCK DATA FROM APIs
// ================================================

// OPTION 1: Yahoo Finance via RapidAPI (Most comprehensive, paid)
// ------------------------------------------------
// Sign up at: https://rapidapi.com/apidojo/api/yahoo-finance1

async function getYahooFinanceData(ticker) {
    const options = {
        method: 'GET',
        headers: {
            'X-RapidAPI-Key': 'YOUR-RAPIDAPI-KEY',
            'X-RapidAPI-Host': 'yahoo-finance-low-latency.p.rapidapi.com'
        }
    };

    try {
        // Get real-time quote
        const quoteResponse = await fetch(
            `https://yahoo-finance-low-latency.p.rapidapi.com/v6/finance/quote?symbols=${ticker}`,
            options
        );
        const quoteData = await quoteResponse.json();
        
        // Get historical data
        const historyResponse = await fetch(
            `https://yahoo-finance-low-latency.p.rapidapi.com/v8/finance/chart/${ticker}?interval=1d&range=1mo`,
            options
        );
        const historyData = await historyResponse.json();
        
        return {
            price: quoteData.quoteResponse.result[0].regularMarketPrice,
            change: quoteData.quoteResponse.result[0].regularMarketChange,
            changePercent: quoteData.quoteResponse.result[0].regularMarketChangePercent,
            volume: quoteData.quoteResponse.result[0].regularMarketVolume,
            marketCap: quoteData.quoteResponse.result[0].marketCap,
            history: historyData
        };
    } catch (error) {
        console.error('Yahoo Finance API Error:', error);
        return null;
    }
}

// OPTION 2: Alpha Vantage (Free tier available - 5 calls/min)
// ------------------------------------------------
// Get free API key at: https://www.alphavantage.co/support/#api-key

async function getAlphaVantageData(ticker) {
    const API_KEY = 'YOUR-ALPHA-VANTAGE-KEY';
    
    try {
        // Real-time quote
        const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${API_KEY}`;
        const quoteResponse = await fetch(quoteUrl);
        const quoteData = await quoteResponse.json();
        
        // Intraday data
        const intradayUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${ticker}&interval=5min&apikey=${API_KEY}`;
        const intradayResponse = await fetch(intradayUrl);
        const intradayData = await intradayResponse.json();
        
        const quote = quoteData['Global Quote'];
        return {
            price: parseFloat(quote['05. price']),
            change: parseFloat(quote['09. change']),
            changePercent: quote['10. change percent'],
            volume: parseInt(quote['06. volume']),
            previousClose: parseFloat(quote['08. previous close']),
            open: parseFloat(quote['02. open']),
            high: parseFloat(quote['03. high']),
            low: parseFloat(quote['04. low']),
            intraday: intradayData
        };
    } catch (error) {
        console.error('Alpha Vantage API Error:', error);
        return null;
    }
}

// OPTION 3: IEX Cloud (Best for production, reliable)
// ------------------------------------------------
// Sign up at: https://iexcloud.io/
// Free tier: 50,000 messages/month

async function getIEXCloudData(ticker) {
    const API_KEY = 'YOUR-IEX-CLOUD-KEY'; // Use publishable token
    const baseUrl = 'https://cloud.iexapis.com/stable';
    
    try {
        // Quote data
        const quoteUrl = `${baseUrl}/stock/${ticker}/quote?token=${API_KEY}`;
        const quoteResponse = await fetch(quoteUrl);
        const quote = await quoteResponse.json();
        
        // Company info
        const companyUrl = `${baseUrl}/stock/${ticker}/company?token=${API_KEY}`;
        const companyResponse = await fetch(companyUrl);
        const company = await companyResponse.json();
        
        // Historical prices (1 month)
        const historyUrl = `${baseUrl}/stock/${ticker}/chart/1m?token=${API_KEY}`;
        const historyResponse = await fetch(historyUrl);
        const history = await historyResponse.json();
        
        return {
            price: quote.latestPrice,
            change: quote.change,
            changePercent: quote.changePercent,
            volume: quote.volume,
            marketCap: quote.marketCap,
            peRatio: quote.peRatio,
            week52High: quote.week52High,
            week52Low: quote.week52Low,
            company: company,
            history: history
        };
    } catch (error) {
        console.error('IEX Cloud API Error:', error);
        return null;
    }
}

// OPTION 4: Finnhub (Good free tier - 60 calls/min)
// ------------------------------------------------
// Get API key at: https://finnhub.io/

async function getFinnhubData(ticker) {
    const API_KEY = 'YOUR-FINNHUB-KEY';
    const baseUrl = 'https://finnhub.io/api/v1';
    
    try {
        // Real-time quote
        const quoteUrl = `${baseUrl}/quote?symbol=${ticker}&token=${API_KEY}`;
        const quoteResponse = await fetch(quoteUrl);
        const quote = await quoteResponse.json();
        
        // Company profile
        const profileUrl = `${baseUrl}/stock/profile2?symbol=${ticker}&token=${API_KEY}`;
        const profileResponse = await fetch(profileUrl);
        const profile = await profileResponse.json();
        
        return {
            price: quote.c, // Current price
            change: quote.d, // Change
            changePercent: quote.dp, // Change percent
            high: quote.h, // High of the day
            low: quote.l, // Low of the day
            open: quote.o, // Open price
            previousClose: quote.pc, // Previous close
            timestamp: quote.t,
            company: profile
        };
    } catch (error) {
        console.error('Finnhub API Error:', error);
        return null;
    }
}

// OPTION 5: Twelve Data (Good for technical indicators)
// ------------------------------------------------
// Get API key at: https://twelvedata.com/

async function getTwelveData(ticker) {
    const API_KEY = 'YOUR-TWELVE-DATA-KEY';
    const baseUrl = 'https://api.twelvedata.com';
    
    try {
        // Real-time price
        const priceUrl = `${baseUrl}/price?symbol=${ticker}&apikey=${API_KEY}`;
        const priceResponse = await fetch(priceUrl);
        const priceData = await priceResponse.json();
        
        // Quote data
        const quoteUrl = `${baseUrl}/quote?symbol=${ticker}&apikey=${API_KEY}`;
        const quoteResponse = await fetch(quoteUrl);
        const quote = await quoteResponse.json();
        
        // Technical indicators
        const rsiUrl = `${baseUrl}/rsi?symbol=${ticker}&interval=1day&apikey=${API_KEY}`;
        const rsiResponse = await fetch(rsiUrl);
        const rsi = await rsiResponse.json();
        
        return {
            price: parseFloat(priceData.price),
            change: parseFloat(quote.change),
            changePercent: parseFloat(quote.percent_change),
            volume: parseInt(quote.volume),
            high: parseFloat(quote.high),
            low: parseFloat(quote.low),
            open: parseFloat(quote.open),
            previousClose: parseFloat(quote.previous_close),
            rsi: rsi
        };
    } catch (error) {
        console.error('Twelve Data API Error:', error);
        return null;
    }
}

// ================================================
// UNIFIED STOCK DATA FETCHER
// ================================================
// This class provides a unified interface for multiple APIs

class StockDataFetcher {
    constructor(config) {
        this.config = {
            yahooFinance: config.yahooFinanceKey || null,
            alphaVantage: config.alphaVantageKey || null,
            iexCloud: config.iexCloudKey || null,
            finnhub: config.finnhubKey || null,
            twelveData: config.twelveDataKey || null,
            preferredAPI: config.preferredAPI || 'iexCloud'
        };
        
        // Cache to reduce API calls
        this.cache = new Map();
        this.cacheTimeout = 60000; // 1 minute cache
    }
    
    // Get data from cache or fetch new
    async getStockData(ticker) {
        const cacheKey = `${ticker}_${Date.now()}`;
        const cached = this.getFromCache(ticker);
        
        if (cached) {
            return cached;
        }
        
        let data = null;
        
        // Try preferred API first
        switch (this.config.preferredAPI) {
            case 'yahooFinance':
                if (this.config.yahooFinance) {
                    data = await this.getYahooData(ticker);
                }
                break;
            case 'alphaVantage':
                if (this.config.alphaVantage) {
                    data = await this.getAlphaData(ticker);
                }
                break;
            case 'iexCloud':
                if (this.config.iexCloud) {
                    data = await this.getIEXData(ticker);
                }
                break;
            case 'finnhub':
                if (this.config.finnhub) {
                    data = await this.getFinnhubData(ticker);
                }
                break;
            case 'twelveData':
                if (this.config.twelveData) {
                    data = await this.getTwelveData(ticker);
                }
                break;
        }
        
        // Fallback to other APIs if preferred fails
        if (!data) {
            data = await this.tryAllAPIs(ticker);
        }
        
        if (data) {
            this.setCache(ticker, data);
        }
        
        return data;
    }
    
    // Try all available APIs
    async tryAllAPIs(ticker) {
        const apis = [
            { name: 'iexCloud', key: this.config.iexCloud, method: this.getIEXData },
            { name: 'finnhub', key: this.config.finnhub, method: this.getFinnhubData },
            { name: 'alphaVantage', key: this.config.alphaVantage, method: this.getAlphaData },
            { name: 'twelveData', key: this.config.twelveData, method: this.getTwelveData },
            { name: 'yahooFinance', key: this.config.yahooFinance, method: this.getYahooData }
        ];
        
        for (const api of apis) {
            if (api.key) {
                try {
                    const data = await api.method.call(this, ticker);
                    if (data) {
                        console.log(`Successfully fetched data from ${api.name}`);
                        return data;
                    }
                } catch (error) {
                    console.error(`Failed to fetch from ${api.name}:`, error);
                }
            }
        }
        
        return null;
    }
    
    // Individual API methods (simplified versions)
    async getYahooData(ticker) {
        // Implementation using Yahoo Finance API
        return getYahooFinanceData(ticker);
    }
    
    async getAlphaData(ticker) {
        // Implementation using Alpha Vantage API
        return getAlphaVantageData(ticker);
    }
    
    async getIEXData(ticker) {
        // Implementation using IEX Cloud API
        return getIEXCloudData(ticker);
    }
    
    async getFinnhubData(ticker) {
        // Implementation using Finnhub API
        return getFinnhubData(ticker);
    }
    
    async getTwelveData(ticker) {
        // Implementation using Twelve Data API
        return getTwelveData(ticker);
    }
    
    // Cache management
    getFromCache(ticker) {
        const cached = this.cache.get(ticker);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }
    
    setCache(ticker, data) {
        this.cache.set(ticker, {
            data: data,
            timestamp: Date.now()
        });
    }
    
    clearCache() {
        this.cache.clear();
    }
}

// ================================================
// USAGE EXAMPLE FOR YIELDMAX ETFS
// ================================================

// Initialize the fetcher with your API keys
const stockFetcher = new StockDataFetcher({
    iexCloudKey: 'YOUR-IEX-KEY',
    finnhubKey: 'YOUR-FINNHUB-KEY',
    alphaVantageKey: 'YOUR-ALPHA-KEY',
    preferredAPI: 'iexCloud'
});

// Function to update all YieldMax ETF prices
async function updateYieldMaxPrices() {
    const yieldMaxETFs = [
        'MSTY', 'TSLY', 'NVDY', 'PLTY', 'CONY', 'APLY', 
        'GOOY', 'AMZY', 'NFLY', 'DISO', 'XOMO', 'JPMO',
        'AMDY', 'PYPY', 'FBY', 'MRNY', 'AIPY', 'YMAX'
    ];
    
    const updates = [];
    
    for (const ticker of yieldMaxETFs) {
        try {
            const data = await stockFetcher.getStockData(ticker);
            if (data) {
                updates.push({
                    ticker: ticker,
                    price: data.price,
                    change: data.change,
                    changePercent: data.changePercent,
                    volume: data.volume
                });
                
                // Update UI
                updateTickerDisplay(ticker, data);
            }
        } catch (error) {
            console.error(`Error updating ${ticker}:`, error);
        }
        
        // Rate limiting - wait 200ms between requests
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return updates;
}

// Function to update UI with new prices
function updateTickerDisplay(ticker, data) {
    const priceElement = document.getElementById(`${ticker.toLowerCase()}-price`);
    const changeElement = document.getElementById(`${ticker.toLowerCase()}-change`);
    
    if (priceElement) {
        priceElement.textContent = `$${data.price.toFixed(2)}`;
    }
    
    if (changeElement) {
        const changeText = `${data.change >= 0 ? '+' : ''}${data.change.toFixed(2)} (${data.changePercent.toFixed(2)}%)`;
        changeElement.textContent = changeText;
        changeElement.className = data.change >= 0 ? 'positive' : 'negative';
    }
}

// ================================================
// WEBSOCKET REAL-TIME DATA (Advanced)
// ================================================

// Finnhub WebSocket for real-time updates
function setupFinnhubWebSocket(apiKey, tickers) {
    const socket = new WebSocket(`wss://ws.finnhub.io?token=${apiKey}`);
    
    socket.addEventListener('open', function (event) {
        // Subscribe to tickers
        tickers.forEach(ticker => {
            socket.send(JSON.stringify({'type':'subscribe', 'symbol': ticker}));
        });
    });
    
    socket.addEventListener('message', function (event) {
        const data = JSON.parse(event.data);
        if (data.type === 'trade') {
            data.data.forEach(trade => {
                updateTickerDisplay(trade.s, {
                    price: trade.p,
                    volume: trade.v,
                    timestamp: trade.t
                });
            });
        }
    });
    
    return socket;
}

// ================================================
// ERROR HANDLING AND FALLBACKS
// ================================================

class RobustStockDataFetcher extends StockDataFetcher {
    constructor(config) {
        super(config);
        this.fallbackData = new Map(); // Store last known good data
    }
    
    async getStockDataWithFallback(ticker) {
        try {
            const data = await this.getStockData(ticker);
            
            if (data) {
                // Store as fallback
                this.fallbackData.set(ticker, {
                    ...data,
                    timestamp: Date.now(),
                    stale: false
                });
                return data;
            }
        } catch (error) {
            console.error(`Error fetching ${ticker}:`, error);
        }
        
        // Return fallback data if available
        const fallback = this.fallbackData.get(ticker);
        if (fallback) {
            return {
                ...fallback,
                stale: true,
                staleTime: Date.now() - fallback.timestamp
            };
        }
        
        // Return mock data as last resort
        return this.getMockData(ticker);
    }
    
    getMockData(ticker) {
        // Return realistic mock data for development
        const mockPrices = {
            'MSTY': 24.16,
            'TSLY': 15.89,
            'NVDY': 22.34,
            'PLTY': 18.42,
            'CONY': 19.78,
            'APLY': 21.45,
            'GOOY': 17.23
        };
        
        const basePrice = mockPrices[ticker] || 20.00;
        const change = (Math.random() - 0.5) * 2;
        
        return {
            price: basePrice,
            change: change,
            changePercent: (change / basePrice) * 100,
            volume: Math.floor(Math.random() * 1000000),
            mock: true
        };
    }
}

// ================================================
// IMPLEMENTATION TIPS
// ================================================

/*
1. API KEY SECURITY:
   - Never expose API keys in client-side code
   - Use environment variables or server-side proxy
   - Implement rate limiting to avoid exceeding quotas

2. BEST PRACTICES:
   - Cache responses to reduce API calls
   - Implement retry logic with exponential backoff
   - Use WebSockets for real-time updates when available
   - Handle API errors gracefully with fallbacks

3. RECOMMENDED APIS FOR PRODUCTION:
   - IEX Cloud: Best overall for reliability and features
   - Finnhub: Good free tier with WebSocket support
   - Alpha Vantage: Good for free tier, but limited calls
   
4. SERVER-SIDE PROXY EXAMPLE:
*/

// Node.js/Express proxy endpoint
app.get('/api/stock/:ticker', async (req, res) => {
    const { ticker } = req.params;
    const apiKey = process.env.IEX_CLOUD_KEY; // Server-side only
    
    try {
        const response = await fetch(
            `https://cloud.iexapis.com/stable/stock/${ticker}/quote?token=${apiKey}`
        );
        const data = await response.json();
        
        res.json({
            success: true,
            data: {
                ticker: ticker,
                price: data.latestPrice,
                change: data.change,
                changePercent: data.changePercent,
                volume: data.volume
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch stock data'
        });
    }
});

// Export for use in other files
export { StockDataFetcher, RobustStockDataFetcher, updateYieldMaxPrices };
