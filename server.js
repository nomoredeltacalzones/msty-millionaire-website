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
            'https://mstymillionaire.netlify.app' // If you have a Netlify subdomain
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

// API Routes
app.use('/api/proxy', require('./api/proxy'));

// Uncomment these as you fix them
// app.use('/api/auth', require('./api/auth'));
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
        platform: process.env.RAILWAY_ENVIRONMENT || 'local'
    });
});

// Test database endpoint
app.get('/api/test-db', async (req, res) => {
    try {
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: IS_PRODUCTION ? { rejectUnauthorized: false } : false
        });
        
        // Create tables if they don't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(255),
                email_verified BOOLEAN DEFAULT false,
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
        
        const result = await pool.query('SELECT NOW()');
        pool.end();
        
        res.json({
            success: true,
            message: 'Database connected and tables created',
            time: result.rows[0].now
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API 404 handler
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// For Railway deployment - serve API only
if (IS_PRODUCTION) {
    // Root endpoint for Railway
    app.get('/', (req, res) => {
        res.json({
            name: 'MSTY Millionaire API',
            version: '1.0.0',
            status: 'running',
            endpoints: {
                health: '/api/health',
                proxy: '/api/proxy/*',
                auth: '/api/auth/*',
                test_db: '/api/test-db'
            }
        });
    });
} else {
    // In development, serve static files
    app.use(express.static(path.join(__dirname)));
    app.use('/assets', express.static(path.join(__dirname, 'assets')));
    app.use('/css', express.static(path.join(__dirname, 'css')));
    app.use('/js', express.static(path.join(__dirname, 'js')));
    app.use('/images', express.static(path.join(__dirname, 'images')));
    app.use('/calculator', express.static(path.join(__dirname, 'calculator')));
    
    // Serve HTML routes in development
    const htmlRoutes = {
        '/': '/index.html',
        '/calculator': '/calculator/index.html',
        '/portfolio': '/portfolio/index.html',
        // Add more routes as needed
    };
    
    Object.entries(htmlRoutes).forEach(([route, filePath]) => {
        app.get(route, (req, res) => {
            const fullPath = path.join(__dirname, filePath);
            if (fs.existsSync(fullPath)) {
                res.sendFile(fullPath);
            } else {
                res.status(404).send('Page not found');
            }
        });
    });
}

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
║  Port: ${PORT}                                ║
║  Environment: ${process.env.NODE_ENV || 'development'}              ║
║  Platform: ${process.env.RAILWAY_ENVIRONMENT || 'Local'}          ║
║  Database: ${process.env.DATABASE_URL ? 'Configured' : 'Not configured'}     ║
╚════════════════════════════════════════════╝
    `);
    
    if (IS_PRODUCTION) {
        console.log('\n🚀 Running in PRODUCTION mode - API only');
    } else {
        console.log(`\n🔧 Running in DEVELOPMENT mode`);
        console.log(`📍 Local URL: http://localhost:${PORT}`);
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
