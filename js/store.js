// Data Store for managing application state and API calls
class DataStore {
    constructor() {
        this.cache = new Map();
        this.subscribers = new Map();
        this.ws = null;
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
        this.apiBaseUrl = window.location.origin;
    }

    // Initialize store
    async init() {
        if (this.token) {
            try {
                await this.loadUserData();
                this.connectWebSocket();
            } catch (error) {
                console.error('Failed to initialize user data:', error);
                this.clearAuth();
            }
        }
        this.setupAuthUI();
    }

    // Authentication methods
    setAuth(token, user) {
        this.token = token;
        this.user = user;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        this.setupAuthUI();
        this.connectWebSocket();
    }

    clearAuth() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.setupAuthUI();
        if (this.ws) {
            this.ws.close();
        }
    }

    async loadUserData() {
        if (!this.token) return;
        
        try {
            const response = await this.apiCall('/auth/me');
            this.user = response.user;
            localStorage.setItem('user', JSON.stringify(this.user));
        } catch (error) {
            console.error('Failed to load user data:', error);
            this.clearAuth();
        }
    }

    // Setup authentication UI
    setupAuthUI() {
        const authButtons = document.querySelectorAll('.auth-button');
        const userMenu = document.querySelector('.user-menu');
        const loginButton = document.querySelector('.login-button');
        const signupButton = document.querySelector('.signup-button');

        if (this.user) {
            // User is logged in
            authButtons.forEach(btn => btn.style.display = 'none');
            if (userMenu) {
                userMenu.style.display = 'block';
                const userEmail = userMenu.querySelector('.user-email');
                if (userEmail) userEmail.textContent = this.user.email;
            }
        } else {
            // User is not logged in
            authButtons.forEach(btn => btn.style.display = 'inline-block');
            if (userMenu) userMenu.style.display = 'none';
        }
    }

    // Cache with TTL
    setCache(key, data, ttl = 60000) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
    }

    getCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;

        if (Date.now() - cached.timestamp > cached.ttl) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    // API calls with authentication
    async apiCall(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api${endpoint}`, {
                ...options,
                headers
            });

            if (!response.ok) {
                if (response.status === 401) {
                    this.clearAuth();
                    if (window.location.pathname !== '/login') {
                        window.location.href = '/login';
                    }
                }
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `API error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }

    // Authentication API calls
    async login(email, password) {
        try {
            const response = await this.apiCall('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            this.setAuth(response.token, response.user);
            return response;
        } catch (error) {
            throw error;
        }
    }

    async register(email, password, fullName) {
        try {
            const response = await this.apiCall('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ email, password, fullName })
            });

            this.setAuth(response.token, response.user);
            return response;
        } catch (error) {
            throw error;
        }
    }

    async logout() {
        try {
            if (this.token) {
                await this.apiCall('/auth/logout', { method: 'POST' });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.clearAuth();
        }
    }

    // Stock data API calls
    async getStockData(ticker) {
        const cacheKey = `stock:${ticker}`;
        const cached = this.getCache(cacheKey);
        if (cached) return cached;

        try {
            const data = await this.apiCall(`/stock/${ticker}`);
            this.setCache(cacheKey, data, 60000); // Cache for 1 minute
            return data;
        } catch (error) {
            console.error(`Failed to fetch stock data for ${ticker}:`, error);
            throw error;
        }
    }

    async getBatchStockData(tickers) {
        try {
            return await this.apiCall('/stocks/batch', {
                method: 'POST',
                body: JSON.stringify({ tickers })
            });
        } catch (error) {
            console.error('Failed to fetch batch stock data:', error);
            throw error;
        }
    }

    async getYieldMaxYields() {
        const cacheKey = 'yieldmax:yields';
        const cached = this.getCache(cacheKey);
        if (cached) return cached;

        try {
            const data = await this.apiCall('/yieldmax/yields');
            this.setCache(cacheKey, data, 300000); // Cache for 5 minutes
            return data;
        } catch (error) {
            console.error('Failed to fetch YieldMax yields:', error);
            throw error;
        }
    }

    // Portfolio API calls
    async getPortfolioHoldings() {
        try {
            return await this.apiCall('/portfolio/holdings');
        } catch (error) {
            console.error('Failed to fetch portfolio holdings:', error);
            throw error;
        }
    }

    async addHolding(ticker, shares, avgCost) {
        try {
            return await this.apiCall('/portfolio/holdings', {
                method: 'POST',
                body: JSON.stringify({
                    ticker: ticker.toUpperCase(),
                    shares: parseFloat(shares),
                    avg_cost: parseFloat(avgCost)
                })
            });
        } catch (error) {
            console.error('Failed to add holding:', error);
            throw error;
        }
    }

    async updateHolding(holdingId, shares, avgCost) {
        try {
            return await this.apiCall(`/portfolio/holdings/${holdingId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    shares: parseFloat(shares),
                    avg_cost: parseFloat(avgCost)
                })
            });
        } catch (error) {
            console.error('Failed to update holding:', error);
            throw error;
        }
    }

    async deleteHolding(holdingId) {
        try {
            return await this.apiCall(`/portfolio/holdings/${holdingId}`, {
                method: 'DELETE'
            });
        } catch (error) {
            console.error('Failed to delete holding:', error);
            throw error;
        }
    }

    // WebSocket connection for real-time data
    connectWebSocket() {
        if (!this.token) return;

        const wsUrl = window.location.protocol === 'https:'
            ? 'wss://' + window.location.host + '/ws'
            : 'ws://' + window.location.host + '/ws';

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                // Subscribe to updates for current page
                this.subscribeToCurrentPageData();
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.updateSubscribers(data);
                } catch (error) {
                    console.error('WebSocket message error:', error);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                // Attempt to reconnect after 5 seconds
                setTimeout(() => {
                    if (this.token) {
                        this.connectWebSocket();
                    }
                }, 5000);
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
        }
    }

    // Subscribe to real-time updates
    subscribe(ticker, callback) {
        if (!this.subscribers.has(ticker)) {
            this.subscribers.set(ticker, []);
        }
        this.subscribers.get(ticker).push(callback);

        // Send subscription to server
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'subscribe',
                ticker: ticker
            }));
        }
    }

    updateSubscribers(data) {
        const { ticker, ...updateData } = data;
        const callbacks = this.subscribers.get(ticker);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(updateData);
                } catch (error) {
                    console.error('Subscriber callback error:', error);
                }
            });
        }
    }

    subscribeToCurrentPageData() {
        // Subscribe to relevant tickers based on current page
        const path = window.location.pathname;
        
        if (path === '/' || path.includes('dashboard')) {
            // Subscribe to main YieldMax ETFs
            ['MSTY', 'TSLY', 'NVDY', 'PLTY'].forEach(ticker => {
                this.subscribe(ticker, (data) => {
                    this.updateETFCard(ticker, data);
                });
            });
        }
    }

    updateETFCard(ticker, data) {
        const card = document.querySelector(`[data-ticker="${ticker}"]`);
        if (card) {
            const priceElement = card.querySelector('.price');
            const changeElement = card.querySelector('.change');
            
            if (priceElement && data.price) {
                priceElement.textContent = `$${data.price.toFixed(2)}`;
            }
            
            if (changeElement && data.change !== undefined) {
                const changePercent = data.changePercent || 0;
                changeElement.textContent = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
                changeElement.className = `change ${changePercent >= 0 ? 'positive' : 'negative'}`;
            }
        }
    }
}

// Error handling utilities
class ErrorHandler {
    static show(message, type = 'error') {
        // Remove existing toasts
        document.querySelectorAll('.toast').forEach(toast => toast.remove());

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${type === 'error' ? '❌' : '✅'}</span>
                <span class="toast-message">${message}</span>
                <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        // Add toast styles if not already present
        if (!document.querySelector('#toast-styles')) {
            const styles = document.createElement('style');
            styles.id = 'toast-styles';
            styles.textContent = `
                .toast {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    max-width: 400px;
                    padding: 16px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    animation: slideIn 0.3s ease-out;
                }
                .toast-error {
                    background: #dc2626;
                    color: white;
                }
                .toast-success {
                    background: #16a34a;
                    color: white;
                }
                .toast-content {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .toast-message {
                    flex: 1;
                }
                .toast-close {
                    background: none;
                    border: none;
                    color: inherit;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                .fade-out {
                    animation: fadeOut 0.3s ease-out forwards;
                }
                @keyframes fadeOut {
                    to {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(toast);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.add('fade-out');
                setTimeout(() => toast.remove(), 300);
            }
        }, 5000);
    }

    static handleAPIError(error) {
        if (error.message.includes('401')) {
            this.show('Please log in to continue');
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        } else if (error.message.includes('429')) {
            this.show('Rate limit exceeded. Please try again later.');
        } else {
            this.show(error.message || 'Something went wrong. Please try again.');
        }
    }
}

// Global store instance
const store = new DataStore();

// Initialize store when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    store.init();
});

// Export for use in other scripts
window.store = store;
window.ErrorHandler = ErrorHandler;

