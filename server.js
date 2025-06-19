const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const http = require('http');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com", "https://cdn.socket.io"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://api.stripe.com", "wss:", "ws:", "https://finnhub.io", "https://www.alphavantage.co"]
        }
    }
}));

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://mstymillionaire.com', 'https://www.mstymillionaire.com']
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));

// Compression and logging
app.use(compression());
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving
app.use(express.static(path.join(__dirname)));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/images', express.static(path.join(__dirname, 'images')));

// API Routes - Add all required routes from Google Doc
app.use('/api/proxy', require('./api/proxy'));
app.use('/api/auth', require('./api/auth'));
app.use('/api/analytics', require('./api/analytics'));
app.use('/api/payments', require('./api/payments'));

// These routes need to be created based on your existing structure
// Comment out if files don't exist yet
/*
app.use('/api/portfolio', require('./src/routes/portfolio'));
app.use('/api/alerts', require('./src/routes/alerts'));
app.use('/api/data', require('./src/routes/data'));
*/

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// API 404 handler
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// Serve HTML files for specific routes
const htmlRoutes = {
    '/': 'index.html',
    '/calculator': 'calculator-page.html',
    '/education': 'education-v2.html',
    '/portfolio': 'portfolio-v2.html',
    '/faq': 'faq-page.html',
    '/contact': 'contact-page.html',
    '/about': 'about-page.html',
    '/login': 'account-login.html',
    '/register': 'account-register.html',
    '/privacy': 'privacy-policy.html',
    '/terms': 'terms-of-service.html',
    '/disclaimer': 'investment-disclaimer.html'
};

// HTML route handler
Object.entries(htmlRoutes).forEach(([route, file]) => {
    app.get(route, (req, res) => {
        res.sendFile(path.join(__dirname, file));
    });
});

// SPA routing - serve appropriate HTML for all non-API routes
app.get('*', (req, res) => {
    // Check if it's a static file request
    if (req.path.includes('.')) {
        return res.status(404).sendFile(path.join(__dirname, '404-error-page.html'));
    }
    
    // For all other routes, try to find matching HTML file
    const possibleFiles = [
        path.join(__dirname, req.path, 'index.html'),
        path.join(__dirname, req.path + '.html'),
        path.join(__dirname, req.path.replace(/\/$/, '') + '.html')
    ];
    
    for (const file of possibleFiles) {
        if (require('fs').existsSync(file)) {
            return res.sendFile(file);
        }
    }
    
    // Default to main index.html
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    
    // Handle specific error types
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (err.name === 'ValidationError') {
        return res.status(400).json({ error: err.message });
    }
    
    res.status(500).json({
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// 404 handler (this should be last)
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '404-error-page.html'));
});

// Create HTTP server (required for Socket.IO)
const server = http.createServer(app);

// Setup WebSocket with Socket.IO
const setupWebSocket = require('./api/websocket');
const io = setupWebSocket(server);

// Make io available to other parts of your app if needed
app.set('io', io);

// Start server
server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║        MSTY Millionaire Server             ║
╠════════════════════════════════════════════╣
║  Status: Running ✅                        ║
║  Port: ${PORT}                                ║
║  Environment: ${process.env.NODE_ENV || 'development'}              ║
║  URL: http://localhost:${PORT}              ║
╚════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

// The module.exports is optional but recommended for testing
module.exports = app;