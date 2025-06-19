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

// Security middleware
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

// Static file serving - IMPORTANT: Serve the root directory
app.use(express.static(path.join(__dirname)));

// Serve subdirectories
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/calculator', express.static(path.join(__dirname, 'calculator')));
app.use('/api', express.static(path.join(__dirname, 'api')));

// API Routes - Uncomment when ready
// app.use('/api/auth', require('./api/auth'));
// app.use('/api/analytics', require('./api/analytics'));
// app.use('/api/payments', require('./api/payments'));

// Working API route
app.use('/api/proxy', require('./api/proxy'));

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

// Define all your HTML routes - UPDATED WITH CORRECT PATHS
const htmlRoutes = {
    // Main pages
    '/': '/index.html',
    '/home': '/index.html',
    
    // Calculator routes - FIXED PATHS
    '/calculator': '/calculator/index.html',
    '/calculator/income': '/calculator/income-calculator/index.html',
    '/calculator/compound': '/calculator/compound-calculator/index.html',
    '/calculator/portfolio-optimizer': '/calculator/portfolio-optimizer/index.html',
    '/calculator/risk-assessment': '/calculator/risk-assessment/index.html',
    '/calculator/tax': '/calculator/tax-calculator/index.html',
    
    // Other main sections (update these with actual file paths when available)
    '/education': '/education/index.html',
    '/portfolio': '/portfolio/index.html',
    '/faq': '/faq/index.html',
    '/contact': '/contact/index.html',
    '/about': '/about/index.html',
    
    // Account pages
    '/login': '/account-login.html',
    '/register': '/account-register.html',
    
    // Legal pages
    '/privacy': '/privacy-policy.html',
    '/terms': '/terms-of-service.html',
    '/disclaimer': '/investment-disclaimer.html',
    
    // API documentation
    '/api/docs': '/api/documentation.html'
};

// HTML route handler - IMPROVED VERSION
Object.entries(htmlRoutes).forEach(([route, filePath]) => {
    app.get(route, (req, res) => {
        const fullPath = path.join(__dirname, filePath);
        
        // Check if file exists
        if (fs.existsSync(fullPath)) {
            res.sendFile(fullPath);
        } else {
            console.warn(`File not found: ${fullPath} for route: ${route}`);
            // Try to serve the 404 page, or default to index.html
            const notFoundPath = path.join(__dirname, '404-error-page.html');
            if (fs.existsSync(notFoundPath)) {
                res.status(404).sendFile(notFoundPath);
            } else {
                res.status(404).sendFile(path.join(__dirname, 'index.html'));
            }
        }
    });
});

// Handle all calculator subpages with a wildcard route
app.get('/calculator/*', (req, res) => {
    const requestedPath = req.path;
    const possiblePaths = [
        path.join(__dirname, requestedPath, 'index.html'),
        path.join(__dirname, requestedPath + '.html'),
        path.join(__dirname, requestedPath.replace(/\/$/, '') + '/index.html')
    ];
    
    for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
            return res.sendFile(possiblePath);
        }
    }
    
    // If no match, try to serve calculator main page
    const calculatorIndex = path.join(__dirname, 'calculator/index.html');
    if (fs.existsSync(calculatorIndex)) {
        res.sendFile(calculatorIndex);
    } else {
        res.status(404).sendFile(path.join(__dirname, '404-error-page.html'));
    }
});

// Catch-all route for SPA - must be after specific routes
app.get('*', (req, res) => {
    // Skip if it's a file request (has extension)
    if (path.extname(req.path)) {
        return res.status(404).send('File not found');
    }
    
    // For all other routes, serve index.html
    res.sendFile(path.join(__dirname, 'index.html'));
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
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// Create HTTP server
const server = http.createServer(app);

// Setup WebSocket with Socket.IO - Comment out if not ready
try {
    const setupWebSocket = require('./api/websocket');
    const io = setupWebSocket(server);
    app.set('io', io);
} catch (error) {
    console.warn('WebSocket setup skipped:', error.message);
}

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
    
    // Log available routes in development
    if (process.env.NODE_ENV !== 'production') {
        console.log('\nAvailable routes:');
        Object.keys(htmlRoutes).forEach(route => {
            console.log(`  ${route}`);
        });
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

module.exports = app;
