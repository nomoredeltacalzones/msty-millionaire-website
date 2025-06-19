// API Configuration for Frontend
// This file connects your Netlify frontend to your Railway backend

// Your Railway API URL
const RAILWAY_API_URL = 'https://nodejs-production-4825.up.railway.app';

// API Configuration
const API_CONFIG = {
    // Automatic environment detection
    baseURL: window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api'
        : `${RAILWAY_API_URL}/api`,
    
    timeout: 30000,
    
    headers: {
        'Content-Type': 'application/json'
    }
};

// API Helper Class
class APIClient {
    constructor() {
        this.baseURL = API_CONFIG.baseURL;
        this.token = localStorage.getItem('auth_token');
    }

    // Set auth token
    setToken(token) {
        this.token = token;
        localStorage.setItem('auth_token', token);
    }

    // Clear auth token
    clearToken() {
        this.token = null;
        localStorage.removeItem('auth_token');
    }

    // Make API request
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const config = {
            ...options,
            headers: {
                ...API_CONFIG.headers,
                ...options.headers,
                ...(this.token && { 'Authorization': `Bearer ${this.token}` })
            }
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    // GET request
    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    // POST request
    post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // PUT request
    put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // DELETE request
    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
}

// Create global API client instance
window.apiClient = new APIClient();

// Test API connection
async function testAPIConnection() {
    try {
        const response = await apiClient.get('/health');
        console.log('✅ API Connected:', response);
        return true;
    } catch (error) {
        console.error('❌ API Connection Failed:', error);
        return false;
    }
}

// Portfolio API functions
const PortfolioAPI = {
    // Get user's portfolio
    async getPortfolio() {
        return apiClient.get('/portfolio/holdings');
    },

    // Add new holding
    async addHolding(ticker, shares, avgCost) {
        return apiClient.post('/portfolio/holdings', {
            ticker: ticker.toUpperCase(),
            shares: parseFloat(shares),
            avg_cost: parseFloat(avgCost)
        });
    },

    // Update holding
    async updateHolding(holdingId, shares, avgCost) {
        return apiClient.put(`/portfolio/holdings/${holdingId}`, {
            shares: parseFloat(shares),
            avg_cost: parseFloat(avgCost)
        });
    },

    // Delete holding
    async deleteHolding(holdingId) {
        return apiClient.delete(`/portfolio/holdings/${holdingId}`);
    },

    // Get portfolio summary
    async getPortfolioSummary() {
        return apiClient.get('/portfolio/summary');
    }
};

// Stock Data API functions
const StockAPI = {
    // Get single stock quote
    async getQuote(ticker) {
        return apiClient.get(`/proxy/stock/${ticker}`);
    },

    // Get batch quotes
    async getBatchQuotes(tickers) {
        return apiClient.post('/proxy/stocks/batch', { tickers });
    },

    // Get YieldMax yields
    async getYieldMaxData() {
        return apiClient.get('/proxy/yieldmax/yields');
    },

    // Get company info
    async getCompanyInfo(ticker) {
        return apiClient.get(`/proxy/company/${ticker}`);
    }
};

// Auth API functions
const AuthAPI = {
    // Login
    async login(email, password) {
        const response = await apiClient.post('/auth/login', { email, password });
        if (response.token) {
            apiClient.setToken(response.token);
            // Save user data
            localStorage.setItem('user', JSON.stringify(response.user));
        }
        return response;
    },

    // Register
    async register(email, password, fullName) {
        const response = await apiClient.post('/auth/register', { 
            email, 
            password, 
            fullName 
        });
        if (response.token) {
            apiClient.setToken(response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
        }
        return response;
    },

    // Logout
    async logout() {
        try {
            await apiClient.post('/auth/logout');
        } finally {
            apiClient.clearToken();
            localStorage.removeItem('user');
            window.location.href = '/';
        }
    },

    // Get current user
    async getCurrentUser() {
        return apiClient.get('/auth/me');
    },

    // Check if logged in
    isLoggedIn() {
        return !!localStorage.getItem('auth_token');
    },

    // Get stored user data
    getStoredUser() {
        const userData = localStorage.getItem('user');
        return userData ? JSON.parse(userData) : null;
    }
};

// Calculator API functions
const CalculatorAPI = {
    // Calculate income
    async calculateIncome(data) {
        return apiClient.post('/calculate/income', data);
    },

    // Calculate compound growth
    async calculateCompound(data) {
        return apiClient.post('/calculate/compound', data);
    },

    // Calculate tax implications
    async calculateTax(data) {
        return apiClient.post('/calculate/tax', data);
    }
};

// Export for use in other scripts
window.PortfolioAPI = PortfolioAPI;
window.StockAPI = StockAPI;
window.AuthAPI = AuthAPI;
window.CalculatorAPI = CalculatorAPI;

// Initialize API connection test on page load
document.addEventListener('DOMContentLoaded', () => {
    testAPIConnection().then(connected => {
        if (connected) {
            console.log('🚀 API connection established');
        } else {
            console.warn('⚠️ API connection failed - check your Railway URL');
        }
    });
});
