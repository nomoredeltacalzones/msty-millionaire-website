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

// Uncomment these as you implement them
// app.use('/api/auth', require('./api/auth'));
// app.use('/api/portfolio', require('./api/portfolio'));
// app.use('/api/analytics', require('./api/analytics'));
// app.use('/api/payments', require('./api/payments'));

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
                reset_token VARCHAR(255),
                reset_expires TIMESTAMP,
                subscription_tier VARCHAR(50) DEFAULT 'free',
                stripe_customer_id VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS portfolios (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                ticker VARCHAR(10) NOT NULL,
                shares DECIMAL(10,2) NOT NULL,
                avg_cost DECIMAL(10,2) NOT NULL,
                current_price DECIMAL(10,2),
                last_updated TIMESTAMP DEFAULT NOW(),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                token VARCHAR(255) UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS analytics_events (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                session_id VARCHAR(255),
                event_name VARCHAR(100) NOT NULL,
                event_data JSONB,
                page_url VARCHAR(500),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS price_alerts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                ticker VARCHAR(10) NOT NULL,
                condition VARCHAR(20) NOT NULL,
                target_price DECIMAL(10,2) NOT NULL,
                is_active BOOLEAN DEFAULT true,
                triggered_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS watchlists (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                ticker VARCHAR(10) NOT NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, ticker)
            )
        `);

        // Create indexes
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
            CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
            CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics_events(user_id);
            CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events(event_name);
        `);
        
        const result = await pool.query('SELECT NOW()');
        
        // Get table count
        const tableCount = await pool.query(`
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        `);
        
        pool.end();
        
        res.json({
            success: true,
            message: 'Database connected and tables created',
            time: result.rows[0].now,
            tableCount: parseInt(tableCount.rows[0].count)
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
            proxy: {
                stock: '/api/proxy/stock/:ticker',
                batchStocks: '/api/proxy/stocks/batch',
                yieldmax: '/api/proxy/yieldmax/yields'
            },
            auth: {
                login: '/api/auth/login',
                register: '/api/auth/register',
                logout: '/api/auth/logout',
                me: '/api/auth/me'
            },
            portfolio: '/api/portfolio/*'
        }
    });
});

// HTML Routes - Complete list
const htmlRoutes = [
    // Main pages
    { path: '/', file: 'index.html' },
    
    // Calculator main page and subpages
    { path: '/calculator', file: 'calculator/index.html' },
    { path: '/calculator/', file: 'calculator/index.html' },
    { path: '/calculator/income', file: 'calculator/income-calculator/index.html' },
    { path: '/calculator/income/', file: 'calculator/income-calculator/index.html' },
    { path: '/calculator/compound', file: 'calculator/compound-calculator/index.html' },
    { path: '/calculator/compound/', file: 'calculator/compound-calculator/index.html' },
    { path: '/calculator/tax', file: 'calculator/tax-calculator/index.html' },
    { path: '/calculator/tax/', file: 'calculator/tax-calculator/index.html' },
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
    }
});

// Graceful shutdown
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

module.exports = app;
