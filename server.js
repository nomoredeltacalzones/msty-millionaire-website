const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const http = require('http');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Security middleware with updated CSP for production
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com", "https://cdn.socket.io", "https://cdn.jsdelivr.net", "https://pagead2.googlesyndication.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://api.stripe.com", "wss:", "ws:", "https://finnhub.io", "https://www.alphavantage.co"]
        }
    }
}));

// CORS configuration - UPDATED for Railway + Netlify
app.use(cors({
    origin: IS_PRODUCTION 
        ? [
            'https://mstymillionaire.com', 
            'https://www.mstymillionaire.com',
            'https://mstymillionaire.netlify.app'
          ]
        : ['http://localhost:3000', 'http://localhost:8888', 'http://127.0.0.1:3000'],
    credentials: true
}));

// Compression and logging
app.use(compression());
app.use(morgan(IS_PRODUCTION ? 'combined' : 'dev'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (for both dev and production)
app.use(express.static(path.join(__dirname)));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/css', express.static(path.join(__dirname, 'assets/css')));
app.use('/js', express.static(path.join(__dirname, 'assets/js')));
app.use('/images', express.static(path.join(__dirname, 'assets/images')));

// API Routes
app.use('/api/proxy', require('./api/proxy'));
app.use('/api/portfolio', require('./api/portfolio'));
app.use('/api/newsletter', require('./api/newsletter'));
app.use('/api/user', require('./api/user'));
app.use('/api/watchlist', require('./api/watchlist'));
app.use('/api/game', require('./api/game'));

// Uncomment these as you implement them
app.use('/api/auth', require('./api/auth'));
// app.use('/api/analytics', require('./api/analytics'));
// app.use('/api/payments', require('./api/payments'));

// Temporary endpoint to run portfolio SQL
app.get('/api/run-portfolio-sql', async (req, res) => {
    try {
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: IS_PRODUCTION ? { rejectUnauthorized: false } : false
        });
        
        // The SQL from paste.txt
        const sql = `
-- Create portfolio history table
CREATE TABLE IF NOT EXISTS portfolio_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_value DECIMAL(12,2) NOT NULL,
    total_invested DECIMAL(12,2) NOT NULL,
    daily_return DECIMAL(12,2),
    daily_return_percent DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_portfolio_history_user_date ON portfolio_history(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_history_date ON portfolio_history(date);

-- Create a function to record daily portfolio snapshot
CREATE OR REPLACE FUNCTION record_portfolio_snapshot(p_user_id INTEGER)
RETURNS void AS $$
DECLARE
    v_total_value DECIMAL(12,2);
    v_total_invested DECIMAL(12,2);
    v_yesterday_value DECIMAL(12,2);
    v_daily_return DECIMAL(12,2);
    v_daily_return_percent DECIMAL(5,2);
BEGIN
    -- Calculate current portfolio value
    SELECT 
        COALESCE(SUM(shares * COALESCE(current_price, avg_cost)), 0),
        COALESCE(SUM(shares * avg_cost), 0)
    INTO v_total_value, v_total_invested
    FROM portfolios
    WHERE user_id = p_user_id;
    
    -- Get yesterday's value
    SELECT total_value 
    INTO v_yesterday_value
    FROM portfolio_history
    WHERE user_id = p_user_id 
    AND date = CURRENT_DATE - INTERVAL '1 day';
    
    -- Calculate daily return
    IF v_yesterday_value IS NOT NULL AND v_yesterday_value > 0 THEN
        v_daily_return := v_total_value - v_yesterday_value;
        v_daily_return_percent := (v_daily_return / v_yesterday_value) * 100;
    ELSE
        v_daily_return := 0;
        v_daily_return_percent := 0;
    END IF;
    
    -- Insert or update today's snapshot
    INSERT INTO portfolio_history (user_id, date, total_value, total_invested, daily_return, daily_return_percent)
    VALUES (p_user_id, CURRENT_DATE, v_total_value, v_total_invested, v_daily_return, v_daily_return_percent)
    ON CONFLICT (user_id, date) 
    DO UPDATE SET 
        total_value = EXCLUDED.total_value,
        total_invested = EXCLUDED.total_invested,
        daily_return = EXCLUDED.daily_return,
        daily_return_percent = EXCLUDED.daily_return_percent,
        created_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Create view for portfolio performance metrics
CREATE OR REPLACE VIEW portfolio_performance AS
WITH date_ranges AS (
    SELECT 
        CURRENT_DATE - INTERVAL '1 day' as one_day_ago,
        CURRENT_DATE - INTERVAL '1 week' as one_week_ago,
        CURRENT_DATE - INTERVAL '1 month' as one_month_ago,
        CURRENT_DATE - INTERVAL '3 months' as three_months_ago,
        CURRENT_DATE - INTERVAL '6 months' as six_months_ago,
        CURRENT_DATE - INTERVAL '1 year' as one_year_ago
)
SELECT 
    ph.user_id,
    -- Current values
    (SELECT total_value FROM portfolio_history WHERE user_id = ph.user_id ORDER BY date DESC LIMIT 1) as current_value,
    (SELECT total_invested FROM portfolio_history WHERE user_id = ph.user_id ORDER BY date DESC LIMIT 1) as total_invested,
    
    -- 1 Day Performance
    (SELECT total_value FROM portfolio_history WHERE user_id = ph.user_id AND date >= (SELECT one_day_ago FROM date_ranges) ORDER BY date ASC LIMIT 1) as value_1d_ago,
    
    -- 1 Week Performance
    (SELECT total_value FROM portfolio_history WHERE user_id = ph.user_id AND date >= (SELECT one_week_ago FROM date_ranges) ORDER BY date ASC LIMIT 1) as value_1w_ago,
    
    -- 1 Month Performance
    (SELECT total_value FROM portfolio_history WHERE user_id = ph.user_id AND date >= (SELECT one_month_ago FROM date_ranges) ORDER BY date ASC LIMIT 1) as value_1m_ago,
    
    -- 3 Month Performance
    (SELECT total_value FROM portfolio_history WHERE user_id = ph.user_id AND date >= (SELECT three_months_ago FROM date_ranges) ORDER BY date ASC LIMIT 1) as value_3m_ago,
    
    -- 6 Month Performance
    (SELECT total_value FROM portfolio_history WHERE user_id = ph.user_id AND date >= (SELECT six_months_ago FROM date_ranges) ORDER BY date ASC LIMIT 1) as value_6m_ago,
    
    -- 1 Year Performance
    (SELECT total_value FROM portfolio_history WHERE user_id = ph.user_id AND date >= (SELECT one_year_ago FROM date_ranges) ORDER BY date ASC LIMIT 1) as value_1y_ago
FROM portfolio_history ph
GROUP BY ph.user_id;
        `;
        
        await pool.query(sql);
        
        // Check if tables were created
        const tableCheck = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('portfolio_history')
        `);
        
        pool.end();
        
        res.json({
            success: true,
            message: 'Portfolio history tables created successfully!',
            tablesCreated: tableCheck.rows
        });
    } catch (error) {
        console.error('SQL execution error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            detail: error.detail
        });
    }
});

// Health check endpoint - ENHANCED for Railway
app.get('/api/health', async (req, res) => {
    let dbStatus = 'not connected';
    
    // Test database connection
    if (process.env.DATABASE_URL) {
        try {
            const { Pool } = require('pg');
            const pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: IS_PRODUCTION ? { rejectUnauthorized: false } : false
            });
            
            await pool.query('SELECT 1');
            dbStatus = 'connected';
            pool.end();
        } catch (error) {
            dbStatus = `error: ${error.message}`;
        }
    }
    
    res.json({ 
        status: 'healthy',
        timestamp: new Date(),
        environment: process.env.NODE_ENV || 'development',
        database: dbStatus,
        port: PORT,
        platform: process.env.RAILWAY_ENVIRONMENT || 'local',
        version: '1.0.0'
    });
});

// Test database endpoint with enhanced table creation
app.get('/api/test-db', async (req, res) => {
    try {
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: IS_PRODUCTION ? { rejectUnauthorized: false } : false
        });
        
        // Create all necessary tables
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(255),
                email_verified BOOLEAN DEFAULT false,
                verification_token VARCHAR(255),
                subscription_tier VARCHAR(50) DEFAULT 'free',
                stripe_customer_id VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                token TEXT NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS password_resets (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                token VARCHAR(255) NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            CREATE TABLE IF NOT EXISTS analytics_events (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                event_name VARCHAR(100) NOT NULL,
                event_data JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- Create indexes for performance
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);
        `);
        
        // Check if tables were created
        const tableCheck = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('users', 'sessions', 'password_resets', 'analytics_events')
        `);
        
        pool.end();
        
        res.json({
            success: true,
            message: 'Database tables for authentication created successfully!',
            tablesCreated: tableCheck.rows
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stack: IS_PRODUCTION ? undefined : error.stack
        });
    }
});

// API Info endpoint
app.get('/api', (req, res) => {
    res.json({
        name: 'MSTY Millionaire API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: '/api/health',
            testDb: '/api/test-db',
            runPortfolioSql: '/api/run-portfolio-sql',
            proxy: {
                stock: '/api/proxy/stock/:ticker',
                batchStocks: '/api/proxy/stocks/batch',
                yieldmax: '/api/proxy/yieldmax/yields'
            },
            portfolio: {
                holdings: '/api/portfolio/holdings',
                summary: '/api/portfolio/summary',
                performance: '/api/portfolio/performance',
                history: '/api/portfolio/history',
                updatePrices: '/api/portfolio/update-prices'
            },
            auth: {
                login: '/api/auth/login',
                register: '/api/auth/register',
                logout: '/api/auth/logout',
                me: '/api/auth/me'
            }
        }
    });
});

// HTML Routes - Complete list
const htmlRoutes = [
    // Main pages
    { path: '/', file: 'index.html' },
    
    // Calculator main page and subpages
    { path: '/calculator', file: 'calculator.html' },
    { path: '/calculator/', file: 'calculator.html' },
    { path: '/calculator/income', file: 'calculator/income-calculator/index.html' },
    { path: '/calculator/income/', file: 'calculator/income-calculator/index.html' },
    { path: '/calculator/compound', file: 'compound-calculator.html' },
    { path: '/calculator/compound/', file: 'compound-calculator.html' },
    { path: '/calculator/tax', file: 'tax-calculator.html' },
    { path: '/calculator/tax/', file: 'tax-calculator.html' },
    { path: '/calculator/risk-assessment', file: 'calculator/risk-assessment/index.html' },
    { path: '/calculator/risk-assessment/', file: 'calculator/risk-assessment/index.html' },
    { path: '/calculator/portfolio-optimizer', file: 'calculator/portfolio-optimizer/index.html' },
    { path: '/calculator/portfolio-optimizer/', file: 'calculator/portfolio-optimizer/index.html' },
    
    // Other main sections
    { path: '/portfolio', file: 'portfolio/index.html' },
    { path: '/portfolio/', file: 'portfolio/index.html' },
    { path: '/education', file: 'education/index.html' },
    { path: '/education/', file: 'education/index.html' },
    { path: '/faq', file: 'faq/index.html' },
    { path: '/faq/', file: 'faq/index.html' },
    { path: '/contact', file: 'contact/index.html' },
    { path: '/contact/', file: 'contact/index.html' },
    
    // Account pages
    { path: '/login', file: 'account-login.html' },
    { path: '/register', file: 'account-register.html' },
    { path: '/account', file: 'account-settings.html' },
    
    // Legal pages
    { path: '/privacy', file: 'privacy-policy.html' },
    { path: '/terms', file: 'terms-of-service.html' },
    { path: '/disclaimer', file: 'investment-disclaimer.html' },
    
    // API documentation
    { path: '/api/docs', file: 'api/documentation.html' }
];

// Register all HTML routes
htmlRoutes.forEach(route => {
    app.get(route.path, (req, res) => {
        const filePath = path.join(__dirname, route.file);
        
        if (fs.existsSync(filePath)) {
            res.sendFile(filePath);
        } else {
            console.log(`File not found: ${filePath}`);
            // Try to serve 404 page or fallback to index
            const notFoundPath = path.join(__dirname, '404-error-page.html');
            if (fs.existsSync(notFoundPath)) {
                res.status(404).sendFile(notFoundPath);
            } else {
                res.status(404).sendFile(path.join(__dirname, 'index.html'));
            }
        }
    });
});

// API 404 handler
app.use('/api/*', (req, res) => {
    res.status(404).json({ 
        error: 'API endpoint not found',
        path: req.path 
    });
});

// Catch-all route for client-side routing
app.get('*', (req, res) => {
    // Skip if it's a file request (has extension)
    if (path.extname(req.path)) {
        return res.status(404).send('File not found');
    }
    
    // For all other routes, serve index.html
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).json({
            error: 'Page not found',
            message: IS_PRODUCTION ? 'Not found' : `Could not find ${req.path}`
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (err.name === 'ValidationError') {
        return res.status(400).json({ error: err.message });
    }
    
    res.status(500).json({
        error: 'Something went wrong!',
        message: IS_PRODUCTION ? 'Internal server error' : err.message
    });
});

// Create HTTP server
const server = http.createServer(app);

// Setup WebSocket with Socket.IO (only if not causing issues)
if (!IS_PRODUCTION) {
    try {
        const setupWebSocket = require('./api/websocket');
        const io = setupWebSocket(server);
        app.set('io', io);
    } catch (error) {
        console.log('WebSocket setup skipped:', error.message);
    }
}

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════════╗
║        MSTY Millionaire API Server         ║
╠════════════════════════════════════════════╣
║  Status: Running ✅                        ║
║  Port: ${PORT}                              ║
║  Environment: ${process.env.NODE_ENV || 'development'}              ║
║  Platform: ${process.env.RAILWAY_ENVIRONMENT || 'Local'}          ║
║  Database: ${process.env.DATABASE_URL ? 'Configured' : 'Not configured'}     ║
╚════════════════════════════════════════════╝
    `);
    
    if (IS_PRODUCTION) {
        console.log('\n🚀 Running in PRODUCTION mode');
        console.log('📡 API endpoints available at /api/*');
        console.log('🌐 Frontend served from static files');
    } else {
        console.log(`\n🔧 Running in DEVELOPMENT mode`);
        console.log(`📍 Local URL: http://localhost:${PORT}`);
        console.log(`📡 API Test: http://localhost:${PORT}/api/health`);
        console.log(`🔨 Portfolio SQL: http://localhost:${PORT}/api/run-portfolio-sql`);
    }
});

// ──────────────────────────────────────────────
// Graceful shutdown
// ──────────────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Export the Express app (used by tests or other modules)
module.exports = app;

