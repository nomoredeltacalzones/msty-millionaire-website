// WebSocket Client for Real-time Data
// Handles WebSocket connections for live stock data updates

class WebSocketClient {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // Start with 1 second
        this.maxReconnectDelay = 30000; // Max 30 seconds
        this.subscriptions = new Set();
        this.eventHandlers = new Map();
        this.heartbeatInterval = null;
        this.heartbeatTimeout = null;
        
        this.setupEventHandlers();
    }

    getWebSocketURL() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        
        if (host === 'localhost' || host === '127.0.0.1') {
            return 'ws://localhost:5000';
        } else {
            // Production WebSocket URL - replace with your actual backend URL
            return 'wss://your-backend-api.herokuapp.com';
        }
    }

    setupEventHandlers() {
        // Set up default event handlers
        this.on('connected', (data) => {
            console.log('✅ WebSocket connected:', data);
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.startHeartbeat();
            
            // Re-subscribe to previous subscriptions
            this.resubscribeAll();
        });

        this.on('disconnected', () => {
            console.log('❌ WebSocket disconnected');
            this.isConnected = false;
            this.stopHeartbeat();
        });

        this.on('error', (error) => {
            console.error('WebSocket error:', error);
        });

        this.on('ticker_update', (data) => {
            this.handleTickerUpdate(data);
        });

        this.on('price_alert', (data) => {
            this.handlePriceAlert(data);
        });

        this.on('market_update', (data) => {
            this.handleMarketUpdate(data);
        });
    }

    async connect() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            return;
        }

        const token = localStorage.getItem('auth_token');
        if (!token) {
            console.warn('No auth token available for WebSocket connection');
            return;
        }

        try {
            const wsUrl = this.getWebSocketURL();
            console.log('Connecting to WebSocket:', wsUrl);
            
            this.socket = new WebSocket(wsUrl);
            
            this.socket.onopen = () => {
                console.log('WebSocket connection opened');
                // Send authentication
                this.send('authenticate', { token });
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };

            this.socket.onclose = (event) => {
                console.log('WebSocket connection closed:', event.code, event.reason);
                this.isConnected = false;
                this.stopHeartbeat();
                this.emit('disconnected', { code: event.code, reason: event.reason });
                
                // Attempt to reconnect if not a normal closure
                if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.scheduleReconnect();
                }
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.emit('error', error);
            };

        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            this.emit('error', error);
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.close(1000, 'Client disconnect');
            this.socket = null;
        }
        this.stopHeartbeat();
        this.isConnected = false;
    }

    send(event, data = {}) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            const message = JSON.stringify({ event, data });
            this.socket.send(message);
        } else {
            console.warn('WebSocket not connected, cannot send message:', event, data);
        }
    }

    handleMessage(message) {
        const { event, data } = message;
        this.emit(event, data);
    }

    scheduleReconnect() {
        this.reconnectAttempts++;
        const delay = Math.min(
            this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
            this.maxReconnectDelay
        );
        
        console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
        
        setTimeout(() => {
            if (!this.isConnected) {
                this.connect();
            }
        }, delay);
    }

    startHeartbeat() {
        this.stopHeartbeat();
        
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected) {
                this.send('ping');
                
                // Set timeout for pong response
                this.heartbeatTimeout = setTimeout(() => {
                    console.warn('Heartbeat timeout, disconnecting');
                    this.disconnect();
                }, 5000);
            }
        }, 30000); // Send ping every 30 seconds
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
    }

    // Event system
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }

    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                }
            });
        }
    }

    // Subscription management
    subscribe(ticker) {
        if (this.isConnected) {
            this.send('subscribe', { ticker });
            this.subscriptions.add(ticker);
            console.log(`Subscribed to ${ticker}`);
        } else {
            console.warn(`Cannot subscribe to ${ticker}: WebSocket not connected`);
        }
    }

    unsubscribe(ticker) {
        if (this.isConnected) {
            this.send('unsubscribe', { ticker });
        }
        this.subscriptions.delete(ticker);
        console.log(`Unsubscribed from ${ticker}`);
    }

    resubscribeAll() {
        this.subscriptions.forEach(ticker => {
            this.send('subscribe', { ticker });
        });
    }

    // Data handlers
    handleTickerUpdate(data) {
        const { ticker, data: stockData, timestamp } = data;
        
        // Update UI elements with new data
        this.updateTickerDisplay(ticker, stockData);
        
        // Emit custom event for other components
        document.dispatchEvent(new CustomEvent('ticker-update', {
            detail: { ticker, data: stockData, timestamp }
        }));
    }

    handlePriceAlert(data) {
        const { ticker, condition, target_price, current_price, message } = data;
        
        // Show notification
        this.showNotification('Price Alert', message, 'info');
        
        // Emit custom event
        document.dispatchEvent(new CustomEvent('price-alert', {
            detail: data
        }));
    }

    handleMarketUpdate(data) {
        // Handle general market updates
        document.dispatchEvent(new CustomEvent('market-update', {
            detail: data
        }));
    }

    updateTickerDisplay(ticker, data) {
        // Update ticker displays throughout the page
        const tickerElements = document.querySelectorAll(`[data-ticker="${ticker}"]`);
        
        tickerElements.forEach(element => {
            if (element.classList.contains('price')) {
                element.textContent = `$${data.price?.toFixed(2) || 'N/A'}`;
            }
            if (element.classList.contains('change')) {
                const change = data.change || 0;
                element.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}`;
                element.className = `change ${change >= 0 ? 'positive' : 'negative'}`;
            }
            if (element.classList.contains('change-percent')) {
                const changePercent = data.changePercent || 0;
                element.textContent = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
                element.className = `change-percent ${changePercent >= 0 ? 'positive' : 'negative'}`;
            }
        });
    }

    showNotification(title, message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <h4>${title}</h4>
                <p>${message}</p>
            </div>
            <button class="notification-close">&times;</button>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);

        // Handle close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }
}

// Create global WebSocket client instance
window.wsClient = new WebSocketClient();

// Auto-connect when user is authenticated
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('auth_token')) {
        window.wsClient.connect();
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

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebSocketClient;
}

