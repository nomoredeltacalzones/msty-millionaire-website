// Authentication functionality
class AuthManager {
    constructor() {
        this.store = window.store;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Register form
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // Logout button
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('logout-btn')) {
                this.handleLogout();
            }
        });

        // Show/hide password toggles
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('toggle-password')) {
                this.togglePasswordVisibility(e.target);
            }
        });
    }

    async handleLogin(event) {
        event.preventDefault();
        
        const form = event.target;
        const email = form.email.value.trim();
        const password = form.password.value;
        const submitBtn = form.querySelector('button[type="submit"]');
        
        if (!email || !password) {
            ErrorHandler.show('Please fill in all fields');
            return;
        }

        // Show loading state
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Signing in...';
        submitBtn.disabled = true;

        try {
            await this.store.login(email, password);
            ErrorHandler.show('Successfully logged in!', 'success');
            
            // Redirect to dashboard or intended page
            const urlParams = new URLSearchParams(window.location.search);
            const redirect = urlParams.get('redirect') || '/';
            window.location.href = redirect;
            
        } catch (error) {
            ErrorHandler.show(error.message || 'Login failed');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    async handleRegister(event) {
        event.preventDefault();
        
        const form = event.target;
        const fullName = form.fullName.value.trim();
        const email = form.email.value.trim();
        const password = form.password.value;
        const confirmPassword = form.confirmPassword.value;
        const submitBtn = form.querySelector('button[type="submit"]');
        
        // Validation
        if (!fullName || !email || !password || !confirmPassword) {
            ErrorHandler.show('Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            ErrorHandler.show('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            ErrorHandler.show('Password must be at least 6 characters long');
            return;
        }

        // Show loading state
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Creating account...';
        submitBtn.disabled = true;

        try {
            await this.store.register(email, password, fullName);
            ErrorHandler.show('Account created successfully!', 'success');
            
            // Redirect to dashboard
            window.location.href = '/';
            
        } catch (error) {
            ErrorHandler.show(error.message || 'Registration failed');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    async handleLogout() {
        try {
            await this.store.logout();
            ErrorHandler.show('Successfully logged out', 'success');
            window.location.href = '/';
        } catch (error) {
            console.error('Logout error:', error);
            // Clear auth anyway
            this.store.clearAuth();
            window.location.href = '/';
        }
    }

    togglePasswordVisibility(button) {
        const input = button.previousElementSibling;
        const icon = button.querySelector('i') || button;
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.textContent = '👁️';
        } else {
            input.type = 'password';
            icon.textContent = '👁️‍🗨️';
        }
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.store.token && !!this.store.user;
    }

    // Require authentication for certain pages
    requireAuth() {
        if (!this.isAuthenticated()) {
            const currentPath = window.location.pathname;
            window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
            return false;
        }
        return true;
    }

    // Get current user
    getCurrentUser() {
        return this.store.user;
    }
}

// Portfolio management functionality
class PortfolioManager {
    constructor() {
        this.store = window.store;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Add holding form
        const addHoldingForm = document.getElementById('addHoldingForm');
        if (addHoldingForm) {
            addHoldingForm.addEventListener('submit', (e) => this.handleAddHolding(e));
        }

        // Portfolio actions
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-holding-btn')) {
                this.handleDeleteHolding(e.target.dataset.holdingId);
            }
            if (e.target.classList.contains('edit-holding-btn')) {
                this.showEditHoldingModal(e.target.dataset.holdingId);
            }
        });

        // Load portfolio data if on portfolio page
        if (window.location.pathname.includes('portfolio')) {
            this.loadPortfolioData();
        }
    }

    async loadPortfolioData() {
        try {
            const data = await this.store.getPortfolioHoldings();
            this.renderPortfolio(data);
        } catch (error) {
            ErrorHandler.handleAPIError(error);
        }
    }

    renderPortfolio(data) {
        const { holdings, metrics } = data;
        
        // Update portfolio metrics
        this.updatePortfolioMetrics(metrics);
        
        // Render holdings table
        this.renderHoldingsTable(holdings);
    }

    updatePortfolioMetrics(metrics) {
        const elements = {
            totalValue: document.getElementById('totalValue'),
            totalCost: document.getElementById('totalCost'),
            totalGainLoss: document.getElementById('totalGainLoss'),
            totalGainLossPercent: document.getElementById('totalGainLossPercent'),
            holdingsCount: document.getElementById('holdingsCount')
        };

        if (elements.totalValue) {
            elements.totalValue.textContent = `$${metrics.total_value.toFixed(2)}`;
        }
        if (elements.totalCost) {
            elements.totalCost.textContent = `$${metrics.total_cost.toFixed(2)}`;
        }
        if (elements.totalGainLoss) {
            elements.totalGainLoss.textContent = `$${metrics.total_gain_loss.toFixed(2)}`;
            elements.totalGainLoss.className = metrics.total_gain_loss >= 0 ? 'positive' : 'negative';
        }
        if (elements.totalGainLossPercent) {
            elements.totalGainLossPercent.textContent = `${metrics.total_gain_loss_percent.toFixed(2)}%`;
            elements.totalGainLossPercent.className = metrics.total_gain_loss_percent >= 0 ? 'positive' : 'negative';
        }
        if (elements.holdingsCount) {
            elements.holdingsCount.textContent = metrics.holdings_count;
        }
    }

    renderHoldingsTable(holdings) {
        const tbody = document.getElementById('holdingsTableBody');
        if (!tbody) return;

        tbody.innerHTML = holdings.map(holding => `
            <tr>
                <td>${holding.ticker}</td>
                <td>${holding.shares.toFixed(2)}</td>
                <td>$${holding.avg_cost.toFixed(2)}</td>
                <td>$${holding.current_price.toFixed(2)}</td>
                <td>$${holding.market_value.toFixed(2)}</td>
                <td class="${holding.gain_loss >= 0 ? 'positive' : 'negative'}">
                    $${holding.gain_loss.toFixed(2)} (${holding.gain_loss_percent.toFixed(2)}%)
                </td>
                <td>
                    <button class="edit-holding-btn" data-holding-id="${holding.id}">Edit</button>
                    <button class="delete-holding-btn" data-holding-id="${holding.id}">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    async handleAddHolding(event) {
        event.preventDefault();
        
        const form = event.target;
        const ticker = form.ticker.value.trim().toUpperCase();
        const shares = parseFloat(form.shares.value);
        const avgCost = parseFloat(form.avgCost.value);
        const submitBtn = form.querySelector('button[type="submit"]');
        
        if (!ticker || shares <= 0 || avgCost <= 0) {
            ErrorHandler.show('Please fill in all fields with valid values');
            return;
        }

        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Adding...';
        submitBtn.disabled = true;

        try {
            await this.store.addHolding(ticker, shares, avgCost);
            ErrorHandler.show('Holding added successfully!', 'success');
            form.reset();
            this.loadPortfolioData(); // Refresh portfolio
        } catch (error) {
            ErrorHandler.show(error.message || 'Failed to add holding');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    async handleDeleteHolding(holdingId) {
        if (!confirm('Are you sure you want to delete this holding?')) {
            return;
        }

        try {
            await this.store.deleteHolding(holdingId);
            ErrorHandler.show('Holding deleted successfully!', 'success');
            this.loadPortfolioData(); // Refresh portfolio
        } catch (error) {
            ErrorHandler.show(error.message || 'Failed to delete holding');
        }
    }
}

// Initialize managers when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
    window.portfolioManager = new PortfolioManager();
    
    // Check authentication for protected pages
    const protectedPages = ['/portfolio', '/alerts', '/account'];
    const currentPath = window.location.pathname;
    
    if (protectedPages.some(page => currentPath.includes(page))) {
        if (!window.authManager.requireAuth()) {
            return; // Will redirect to login
        }
    }
});

