// WebSocket Server using Socket.IO
// Save this as: /api/websocket.js

const jwt = require('jsonwebtoken');
const axios = require('axios');

function setupWebSocket(server) {
    // Initialize Socket.IO
    const io = require('socket.io')(server, {
        cors: {
            origin: process.env.NODE_ENV === 'production' 
                ? ['https://mstymillionaire.com', 'https://www.mstymillionaire.com']
                : ['http://localhost:3000', 'http://127.0.0.1:3000'],
            credentials: true
        },
        transports: ['websocket', 'polling']
    });

    // Track subscriptions
    const userSubscriptions = new Map();
    const tickerSubscribers = new Map();

    // Authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            
            if (!token) {
                return next(new Error('Authentication required'));
            }

            // Verify JWT token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.userId;
            socket.userEmail = decoded.email;
            
            next();
        } catch (err) {
            next(new Error('Invalid token'));
        }
    });

    // Handle connections
    io.on('connection', (socket) => {
        console.log(`User ${socket.userId} connected - Socket ID: ${socket.id}`);
        
        // Initialize user's subscription set
        if (!userSubscriptions.has(socket.userId)) {
            userSubscriptions.set(socket.userId, new Set());
        }

        // Send authentication success
        socket.emit('auth_success', {
            userId: socket.userId,
            socketId: socket.id
        });

        // Handle ticker subscription
        socket.on('subscribe', (data) => {
            const { ticker } = data;
            if (!ticker) return;

            const tickerUpper = ticker.toUpperCase();
            
            // Add to user's subscriptions
            userSubscriptions.get(socket.userId).add(tickerUpper);
            
            // Add to ticker's subscribers
            if (!tickerSubscribers.has(tickerUpper)) {
                tickerSubscribers.set(tickerUpper, new Set());
            }
            tickerSubscribers.get(tickerUpper).add(socket.id);
            
            // Join room for this ticker
            socket.join(`ticker:${tickerUpper}`);
            
            console.log(`User ${socket.userId} subscribed to ${tickerUpper}`);
            socket.emit('subscribed', { ticker: tickerUpper });
            
            // Send current price immediately
            sendCurrentPrice(socket, tickerUpper);
        });

        // Handle ticker unsubscription
        socket.on('unsubscribe', (data) => {
            const { ticker } = data;
            if (!ticker) return;

            const tickerUpper = ticker.toUpperCase();
            
            // Remove from user's subscriptions
            userSubscriptions.get(socket.userId).delete(tickerUpper);
            
            // Remove from ticker's subscribers
            if (tickerSubscribers.has(tickerUpper)) {
                tickerSubscribers.get(tickerUpper).delete(socket.id);
            }
            
            // Leave room
            socket.leave(`ticker:${tickerUpper}`);
            
            console.log(`User ${socket.userId} unsubscribed from ${tickerUpper}`);
            socket.emit('unsubscribed', { ticker: tickerUpper });
        });

        // Handle batch subscription
        socket.on('subscribe_batch', (data) => {
            const { tickers } = data;
            if (!Array.isArray(tickers)) return;

            tickers.forEach(ticker => {
                const tickerUpper = ticker.toUpperCase();
                userSubscriptions.get(socket.userId).add(tickerUpper);
                
                if (!tickerSubscribers.has(tickerUpper)) {
                    tickerSubscribers.set(tickerUpper, new Set());
                }
                tickerSubscribers.get(tickerUpper).add(socket.id);
                
                socket.join(`ticker:${tickerUpper}`);
            });

            console.log(`User ${socket.userId} subscribed to batch:`, tickers);
        });

        // Handle batch unsubscription
        socket.on('unsubscribe_batch', (data) => {
            const { tickers } = data;
            if (!Array.isArray(tickers)) return;

            tickers.forEach(ticker => {
                const tickerUpper = ticker.toUpperCase();
                userSubscriptions.get(socket.userId).delete(tickerUpper);
                
                if (tickerSubscribers.has(tickerUpper)) {
                    tickerSubscribers.get(tickerUpper).delete(socket.id);
                }
                
                socket.leave(`ticker:${tickerUpper}`);
            });

            console.log(`User ${socket.userId} unsubscribed from batch:`, tickers);
        });

        // Handle disconnection
        socket.on('disconnect', (reason) => {
            console.log(`User ${socket.userId} disconnected - Reason: ${reason}`);
            
            // Clean up subscriptions
            const userSubs = userSubscriptions.get(socket.userId);
            if (userSubs) {
                userSubs.forEach(ticker => {
                    if (tickerSubscribers.has(ticker)) {
                        tickerSubscribers.get(ticker).delete(socket.id);
                    }
                });
            }
        });

        // Handle errors
        socket.on('error', (error) => {
            console.error(`Socket error for user ${socket.userId}:`, error);
        });
    });

    // Function to send current price
    async function sendCurrentPrice(socket, ticker) {
        try {
            // You would fetch from your API/cache here
            const response = await axios.get(`http://localhost:${process.env.PORT}/api/stock/${ticker}`, {
                headers: { 'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}` }
            });
            
            socket.emit('ticker_update', response.data);
        } catch (error) {
            console.error(`Failed to fetch current price for ${ticker}:`, error);
        }
    }

    // Function to broadcast price updates
    function broadcastPriceUpdate(ticker, data) {
        io.to(`ticker:${ticker}`).emit('ticker_update', {
            ticker,
            price: data.price,
            change: data.change,
            changePercent: data.changePercent,
            volume: data.volume,
            high: data.high,
            low: data.low,
            timestamp: new Date()
        });
    }

    // Function to send alerts
    function sendPriceAlert(userId, alertData) {
        const sockets = Array.from(io.sockets.sockets.values())
            .filter(socket => socket.userId === userId);
        
        sockets.forEach(socket => {
            socket.emit('price_alert', alertData);
        });
    }

    // Start price update loop (every 5 seconds)
    setInterval(async () => {
        // Get all active tickers
        const activeTickers = Array.from(tickerSubscribers.keys());
        
        if (activeTickers.length === 0) return;

        // Fetch updates for all tickers
        for (const ticker of activeTickers) {
            try {
                // Fetch from your API
                const response = await axios.get(`http://localhost:${process.env.PORT}/api/stock/${ticker}`, {
                    headers: { 'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}` }
                });
                
                // Broadcast to all subscribers
                broadcastPriceUpdate(ticker, response.data);
            } catch (error) {
                console.error(`Failed to update ${ticker}:`, error.message);
            }
        }
    }, 5000); // Update every 5 seconds

    // Return io instance for external use
    return io;
}

module.exports = setupWebSocket;