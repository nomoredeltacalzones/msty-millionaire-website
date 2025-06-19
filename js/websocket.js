// WebSocket Client for Real-time Data using Socket.IO
// Save this as: /js/websocket.js

class WebSocketClient {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.subscriptions = new Set();
        this.eventHandlers = new Map();
        this.heartbeatInterval = null;
    }

    getWebSocketURL() {
        const host = window.location.hostname;
        
        if (host === 'localhost' || host === '127.0.0.1') {
            return 'http://localhost:3000';
        } else {
            // Production URL
            return window.location.origin;
        }
    }

    connect() {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            console.warn('No auth token available for WebSocket connection');
            return;
        }

        const wsUrl = this.getWebSocketURL();
        console.log('Connecting to WebSocket:', wsUrl);
        
        // Socket.IO connection with authentication
        this.socket = io(wsUrl, {
            auth: {
                token: token
            },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: this.reconnectDelay,
            reconnectionDelayMax: 10000,
            timeout: 20000
        });

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        // Connection events
        this.socket.on('connect', () => {
            console.log('✅ WebSocket connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            // Resubscribe to all tickers
            this.resubscribeAll();
            
            // Emit custom event
            document.dispatchEvent(new CustomEvent('websocket-connected'));
        });

        this.socket.on('disconnect', (reason) => {
            console.log('❌ WebSocket disconnected:', reason);
            this.isConnected = false;
            
            document.dispatchEvent(new CustomEvent('websocket-disconnected', {
                detail: { reason }
            }));
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error.message);
            this.reconnectAttempts++;
        });

        this.socket.on('error', (error) => {
            console.error('WebSocket error:', error);
            this.showNotification('Connection Error', error.message || 'WebSocket error occurred', 'error');
        });

        // Authentication response
        this.socket.on('auth_success', (data) => {
            console.log('✅ Authentication successful:', data);
        });

        this.socket.on('auth_error', (data) => {
            console.error('❌ Authentication failed:', data);
            this.showNotification('Authentication Failed', data.message || 'Please login again', 'error');
            this.disconnect();
        });

        // Data events
        this.socket.on('ticker_update', (data) => {
            this.handleTickerUpdate(data);
        });

        this.socket.on('price_alert', (data) => {
            this.handlePriceAlert(data);
        });

        this.socket.on('market_update', (data) => {
            this.handleMarketUpdate(data);
        });

        this.socket.on('distribution_alert', (data) => {
            this.handleDistributionAlert(data);
        });

        this.socket.on('portfolio_update', (data) => {
            this.handlePortfolioUpdate(data);
        });

        // Subscription responses
        this.socket.on('subscribed', (data) => {
            console.log(`✅ Subscribed to ${data.ticker}`);
        });

        this.socket.on('unsubscribed', (data) => {
            console.log(`❌ Unsubscribed from ${data.ticker}`);
        });

        this.socket.on('subscription_error', (data) => {
            console.error(`Subscription error for ${data.ticker}:`, data.error);
        });
    }

    // Connection management
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.isConnected = false;
        this.subscriptions.clear();
    }

    reconnect() {
        this.disconnect();
        setTimeout(() => {
            this.connect();
        }, 1000);
    }

    // Subscription management
    subscribe(ticker) {
        if (!this.isConnected) {
            console.warn(`Cannot subscribe to ${ticker}: Not connected`);
            return;
        }

        this.socket.emit('subscribe', { ticker: ticker.toUpperCase() });
        this.subscriptions.add(ticker.toUpperCase());
        console.log(`Subscribing to ${ticker}`);
    }

    unsubscribe(ticker) {
        if (!this.isConnected) {
            return;
        }

        this.socket.emit('unsubscribe', { ticker: ticker.toUpperCase() });
        this.subscriptions.delete(ticker.toUpperCase());
        console.log(`Unsubscribing from ${ticker}`);
    }

    resubscribeAll() {
        if (!this.isConnected) return;
        
        console.log('Resubscribing to all tickers:', Array.from(this.subscriptions));
        this.subscriptions.forEach(ticker => {
            this.socket.emit('subscribe', { ticker });
        });
    }

    // Batch operations
    subscribeBatch(tickers) {
        if (!this.isConnected) {
            console.warn('Cannot subscribe: Not connected');
            return;
        }

        const tickerList = tickers.map(t => t.toUpperCase());
        this.socket.emit('subscribe_batch', { tickers: tickerList });
        tickerList.forEach(ticker => this.subscriptions.add(ticker));
    }

    unsubscribeBatch(tickers) {
        if (!this.isConnected) return;

        const tickerList = tickers.map(t => t.toUpperCase());
        this.socket.emit('unsubscribe_batch', { tickers: tickerList });
        tickerList.forEach(ticker => this.subscriptions.delete(ticker));
    }

    // Data handlers
    handleTickerUpdate(data) {
        const { ticker, price, change, changePercent, volume, timestamp } = data;
        
        // Update all elements with this ticker
        const priceElements = document.querySelectorAll(`[data-ticker="${ticker}"]`);
        
        priceElements.forEach(element => {
            if (element.classList.contains('price')) {
                const oldPrice = parseFloat(element.textContent.replace('$', ''));
                element.textContent = `$${price.toFixed(2)}`;
                
                // Add animation
                if (price > oldPrice) {
                    element.classList.add('price-up');
                    setTimeout(() => element.classList.remove('price-up'), 1000);
                } else if (price < oldPrice) {
                    element.classList.add('price-down');
                    setTimeout(() => element.classList.remove('price-down'), 1000);
                }
            }
            
            if (element.classList.contains('change')) {
                element.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}`;
                element.className = `change ${change >= 0 ? 'positive' : 'negative'}`;
            }
            
            if (element.classList.contains('change-percent')) {
                element.textContent = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
                element.className = `change-percent ${changePercent >= 0 ? 'positive' : 'negative'}`;
            }
            
            if (element.classList.contains('volume')) {
                element.textContent = this.formatVolume(volume);
            }
        });

        // Emit custom event
        document.dispatchEvent(new CustomEvent('ticker-update', {
            detail: { ticker, price, change, changePercent, volume, timestamp }
        }));
    }

    handlePriceAlert(data) {
        const { ticker, condition, targetPrice, currentPrice, message } = data;
        
        // Show browser notification if permitted
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Price Alert! 🔔', {
                body: message || `${ticker} ${condition} $${targetPrice}`,
                icon: '/images/logo.png',
                tag: `price-alert-${ticker}`,
                requireInteraction: true
            });
        }
        
        // Show in-app notification
        this.showNotification(
            `Price Alert: ${ticker}`,
            message || `${ticker} is now ${condition} your target of $${targetPrice}`,
            'info'
        );
        
        // Emit custom event
        document.dispatchEvent(new CustomEvent('price-alert', {
            detail: data
        }));
    }

    handleMarketUpdate(data) {
        console.log('Market update:', data);
        
        document.dispatchEvent(new CustomEvent('market-update', {
            detail: data
        }));
    }

    handleDistributionAlert(data) {
        const { ticker, exDate, payDate, amount, message } = data;
        
        this.showNotification(
            `Distribution Alert: ${ticker}`,
            message || `Distribution of $${amount} on ${payDate}`,
            'success'
        );
        
        document.dispatchEvent(new CustomEvent('distribution-alert', {
            detail: data
        }));
    }

    handlePortfolioUpdate(data) {
        console.log('Portfolio update:', data);
        
        document.dispatchEvent(new CustomEvent('portfolio-update', {
            detail: data
        }));
    }

    // Custom event emitters
    emit(event, data) {
        if (!this.isConnected) {
            console.warn(`Cannot emit ${event}: Not connected`);
            return;
        }
        
        this.socket.emit(event, data);
    }

    // Custom event listeners
    on(event, callback) {
        this.socket.on(event, callback);
    }

    off(event, callback) {
        this.socket.off(event, callback);
    }

    // Utility methods
    formatVolume(volume) {
        if (volume >= 1000000000) {
            return (volume / 1000000000).toFixed(1) + 'B';
        } else if (volume >= 1000000) {
            return (volume / 1000000).toFixed(1) + 'M';
        } else if (volume >= 1000) {
            return (volume / 1000).toFixed(1) + 'K';
        }
        return volume.toString();
    }

    showNotification(title, message, type = 'info') {
        // Create notification container if it doesn't exist
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }

        // Create notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <h4>${title}</h4>
                <p>${message}</p>
            </div>
            <button class="notification-close">&times;</button>
        `;

        container.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 5000);

        // Handle close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
    }

    // Get connection status
    getStatus() {
        return {
            connected: this.isConnected,
            socketId: this.socket?.id,
            subscriptions: Array.from(this.subscriptions),
            reconnectAttempts: this.reconnectAttempts
        };
    }
}

// Create global WebSocket client instance
window.wsClient = new WebSocketClient();

// Auto-connect when user is authenticated
document.addEventListener('DOMContentLoaded', () => {
    // Add Socket.IO script if not already loaded
    if (!window.io) {
        const script = document.createElement('script');
        script.src = '/socket.io/socket.io.js';
        script.onload = () => {
            // Connect after Socket.IO loads
            if (localStorage.getItem('auth_token')) {
                window.wsClient.connect();
            }
        };
        document.head.appendChild(script);
    } else {
        // Socket.IO already loaded
        if (localStorage.getItem('auth_token')) {
            window.wsClient.connect();
        }
    }
});

// Connect when user logs in
document.addEventListener('user-login', () => {
    window.wsClient.connect();
});

// Disconnect when user logs out
document.addEventListener('user-logout', () => {
    window.wsClient.disconnect();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page is hidden, could disconnect to save resources
        console.log('Page hidden');
    } else {
        // Page is visible again, ensure connection
        if (localStorage.getItem('auth_token') && !window.wsClient.isConnected) {
            window.wsClient.connect();
        }
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebSocketClient;
}