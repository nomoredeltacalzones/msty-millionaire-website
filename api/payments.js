// Payment Processing Client
// Handles Stripe integration and payment flows

class PaymentClient {
    constructor() {
        this.stripe = null;
        this.elements = null;
        this.card = null;
        this.isLoading = false;
        
        this.initializeStripe();
    }

    async initializeStripe() {
        try {
            // Load Stripe.js if not already loaded
            if (!window.Stripe) {
                await this.loadStripeJS();
            }
            
            // Initialize Stripe with publishable key
            const publishableKey = this.getStripePublishableKey();
            this.stripe = window.Stripe(publishableKey);
            
            console.log('✅ Stripe initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Stripe:', error);
        }
    }

    loadStripeJS() {
        return new Promise((resolve, reject) => {
            if (window.Stripe) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://js.stripe.com/v3/';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    getStripePublishableKey() {
        // In production, this should come from your backend or environment
        if (window.location.hostname === 'localhost') {
            return 'pk_test_your_test_key_here';
        } else {
            return 'pk_live_your_live_key_here';
        }
    }

    // Create payment element for card input
    createCardElement(containerId) {
        if (!this.stripe) {
            console.error('Stripe not initialized');
            return null;
        }

        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container ${containerId} not found`);
            return null;
        }

        this.elements = this.stripe.elements();
        
        const style = {
            base: {
                color: '#e4e8f1',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSmoothing: 'antialiased',
                fontSize: '16px',
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                '::placeholder': {
                    color: '#9ca3af'
                }
            },
            invalid: {
                color: '#ef4444',
                iconColor: '#ef4444'
            }
        };

        this.card = this.elements.create('card', { style });
        this.card.mount(container);

        // Handle real-time validation errors
        this.card.on('change', ({ error }) => {
            const displayError = document.getElementById('card-errors');
            if (displayError) {
                if (error) {
                    displayError.textContent = error.message;
                    displayError.style.display = 'block';
                } else {
                    displayError.textContent = '';
                    displayError.style.display = 'none';
                }
            }
        });

        return this.card;
    }

    // Process subscription checkout
    async processSubscriptionCheckout(planType) {
        if (this.isLoading) return;
        
        try {
            this.isLoading = true;
            this.showLoadingState('Creating checkout session...');

            // Create checkout session via API
            const response = await window.apiProxy.post('/api/payments/create-checkout-session', {
                plan_type: planType
            });

            if (response.checkout_url) {
                // Redirect to Stripe checkout
                window.location.href = response.checkout_url;
            } else {
                throw new Error('No checkout URL received');
            }

        } catch (error) {
            console.error('Checkout error:', error);
            this.showError(error.message || 'Failed to start checkout process');
        } finally {
            this.isLoading = false;
            this.hideLoadingState();
        }
    }

    // Process one-time payment
    async processPayment(amount, description, metadata = {}) {
        if (!this.stripe || !this.card) {
            throw new Error('Stripe not properly initialized');
        }

        if (this.isLoading) return;

        try {
            this.isLoading = true;
            this.showLoadingState('Processing payment...');

            // Create payment intent
            const response = await window.apiProxy.post('/api/payments/create-payment-intent', {
                amount: Math.round(amount * 100), // Convert to cents
                description,
                metadata
            });

            const { client_secret } = response;

            // Confirm payment with Stripe
            const result = await this.stripe.confirmCardPayment(client_secret, {
                payment_method: {
                    card: this.card,
                    billing_details: {
                        name: this.getBillingName()
                    }
                }
            });

            if (result.error) {
                throw new Error(result.error.message);
            }

            // Payment succeeded
            this.showSuccess('Payment successful!');
            return result.paymentIntent;

        } catch (error) {
            console.error('Payment error:', error);
            this.showError(error.message || 'Payment failed');
            throw error;
        } finally {
            this.isLoading = false;
            this.hideLoadingState();
        }
    }

    // Get subscription status
    async getSubscriptionStatus() {
        try {
            const response = await window.apiProxy.get('/api/payments/subscription/status');
            return response;
        } catch (error) {
            console.error('Failed to get subscription status:', error);
            return null;
        }
    }

    // Cancel subscription
    async cancelSubscription() {
        if (!confirm('Are you sure you want to cancel your subscription?')) {
            return false;
        }

        try {
            this.showLoadingState('Canceling subscription...');
            
            await window.apiProxy.post('/api/payments/subscription/cancel');
            
            this.showSuccess('Subscription canceled successfully');
            return true;
            
        } catch (error) {
            console.error('Cancel subscription error:', error);
            this.showError(error.message || 'Failed to cancel subscription');
            return false;
        } finally {
            this.hideLoadingState();
        }
    }

    // Update payment method
    async updatePaymentMethod() {
        if (!this.stripe || !this.card) {
            throw new Error('Stripe not properly initialized');
        }

        try {
            this.showLoadingState('Updating payment method...');

            // Create setup intent for updating payment method
            const response = await window.apiProxy.post('/api/payments/create-setup-intent');
            const { client_secret } = response;

            // Confirm setup intent
            const result = await this.stripe.confirmCardSetup(client_secret, {
                payment_method: {
                    card: this.card,
                    billing_details: {
                        name: this.getBillingName()
                    }
                }
            });

            if (result.error) {
                throw new Error(result.error.message);
            }

            this.showSuccess('Payment method updated successfully');
            return result.setupIntent;

        } catch (error) {
            console.error('Update payment method error:', error);
            this.showError(error.message || 'Failed to update payment method');
            throw error;
        } finally {
            this.hideLoadingState();
        }
    }

    // Get available subscription plans
    async getSubscriptionPlans() {
        try {
            const response = await window.apiProxy.get('/api/payments/plans');
            return response.plans;
        } catch (error) {
            console.error('Failed to get subscription plans:', error);
            return {};
        }
    }

    // Utility methods
    getBillingName() {
        // Try to get name from user data or form
        const nameInput = document.querySelector('input[name="name"], input[name="fullName"]');
        if (nameInput) {
            return nameInput.value;
        }
        
        // Fallback to stored user data
        const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
        return userData.fullName || userData.name || 'Customer';
    }

    formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(amount);
    }

    // UI helper methods
    showLoadingState(message = 'Processing...') {
        const loadingElement = document.getElementById('payment-loading');
        if (loadingElement) {
            loadingElement.textContent = message;
            loadingElement.style.display = 'block';
        }

        // Disable payment buttons
        const paymentButtons = document.querySelectorAll('.payment-button, .upgrade-btn');
        paymentButtons.forEach(btn => {
            btn.disabled = true;
            btn.dataset.originalText = btn.textContent;
            btn.textContent = message;
        });
    }

    hideLoadingState() {
        const loadingElement = document.getElementById('payment-loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }

        // Re-enable payment buttons
        const paymentButtons = document.querySelectorAll('.payment-button, .upgrade-btn');
        paymentButtons.forEach(btn => {
            btn.disabled = false;
            if (btn.dataset.originalText) {
                btn.textContent = btn.dataset.originalText;
                delete btn.dataset.originalText;
            }
        });
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showMessage(message, type = 'info') {
        // Create or update message element
        let messageElement = document.getElementById('payment-message');
        if (!messageElement) {
            messageElement = document.createElement('div');
            messageElement.id = 'payment-message';
            messageElement.className = 'payment-message';
            
            // Insert at top of payment container or body
            const container = document.querySelector('.payment-container') || document.body;
            container.insertBefore(messageElement, container.firstChild);
        }

        messageElement.className = `payment-message payment-message-${type}`;
        messageElement.textContent = message;
        messageElement.style.display = 'block';

        // Auto-hide after 5 seconds for success messages
        if (type === 'success') {
            setTimeout(() => {
                messageElement.style.display = 'none';
            }, 5000);
        }
    }

    hideMessage() {
        const messageElement = document.getElementById('payment-message');
        if (messageElement) {
            messageElement.style.display = 'none';
        }
    }

    // Event tracking
    trackPaymentEvent(event, data = {}) {
        if (window.analytics) {
            window.analytics.trackEvent(`payment_${event}`, data);
        }
    }
}

// Create global payment client instance
window.paymentClient = new PaymentClient();

// Initialize payment forms when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Auto-initialize card elements
    const cardContainers = document.querySelectorAll('[data-stripe-card]');
    cardContainers.forEach(container => {
        window.paymentClient.createCardElement(container.id);
    });

    // Handle subscription upgrade buttons
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('upgrade-btn')) {
            const planType = e.target.dataset.plan;
            if (planType) {
                window.paymentClient.processSubscriptionCheckout(planType);
            }
        }
    });
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PaymentClient;
}

