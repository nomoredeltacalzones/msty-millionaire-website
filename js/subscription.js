// Subscription management functionality
class SubscriptionManager {
    constructor() {
        this.store = window.store;
        this.currentSubscription = null;
        this.setupEventListeners();
        this.loadSubscriptionData();
    }

    setupEventListeners() {
        // Upgrade buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('upgrade-btn')) {
                const planType = e.target.dataset.plan;
                this.handleUpgrade(planType);
            }
        });

        // Cancel subscription button
        const cancelBtn = document.getElementById('cancelSubscriptionBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.handleCancelSubscription());
        }

        // Change password button
        const changePasswordBtn = document.getElementById('changePasswordBtn');
        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', () => this.showChangePasswordModal());
        }

        // Check for successful payment
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('success') === 'true') {
            ErrorHandler.show('Subscription activated successfully!', 'success');
            // Remove URL parameters
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        if (urlParams.get('canceled') === 'true') {
            ErrorHandler.show('Payment was canceled. You can try again anytime.');
            // Remove URL parameters
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    async loadSubscriptionData() {
        try {
            // Load subscription status
            const subscriptionData = await this.store.apiCall('/payments/subscription/status');
            this.currentSubscription = subscriptionData;
            this.updateSubscriptionUI(subscriptionData);

            // Load user data
            const userData = await this.store.apiCall('/auth/me');
            this.updateAccountInfo(userData.user);

        } catch (error) {
            console.error('Failed to load subscription data:', error);
            ErrorHandler.handleAPIError(error);
        }
    }

    updateSubscriptionUI(subscription) {
        const currentPlanElement = document.getElementById('currentPlan');
        const planStatusElement = document.getElementById('planStatus');
        const cancelBtn = document.getElementById('cancelSubscriptionBtn');

        if (currentPlanElement) {
            currentPlanElement.textContent = `${subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1)} Plan`;
        }

        if (planStatusElement) {
            if (subscription.tier === 'free') {
                planStatusElement.textContent = 'Free plan - Upgrade to unlock premium features';
            } else if (subscription.is_active) {
                const expiresAt = new Date(subscription.expires_at);
                planStatusElement.textContent = `Active until ${expiresAt.toLocaleDateString()}`;
                if (cancelBtn) cancelBtn.style.display = 'inline-block';
            } else {
                planStatusElement.textContent = 'Subscription expired - Renew to continue using premium features';
            }
        }

        // Update plan cards
        this.updatePlanCards(subscription.tier);
    }

    updatePlanCards(currentTier) {
        const planCards = document.querySelectorAll('.plan-card');
        
        planCards.forEach(card => {
            const upgradeBtn = card.querySelector('.upgrade-btn');
            const planType = upgradeBtn ? upgradeBtn.dataset.plan : 'free';
            
            // Reset button states
            const actionBtn = card.querySelector('.plan-btn');
            if (actionBtn) {
                actionBtn.disabled = false;
                actionBtn.classList.remove('current-plan', 'downgrade');
            }
            
            if (planType === currentTier) {
                // Current plan
                if (actionBtn) {
                    actionBtn.textContent = 'Current Plan';
                    actionBtn.disabled = true;
                    actionBtn.classList.add('current-plan');
                }
            } else if (this.isPlanDowngrade(currentTier, planType)) {
                // Downgrade (not typically offered)
                if (actionBtn) {
                    actionBtn.textContent = 'Downgrade';
                    actionBtn.classList.add('downgrade');
                    actionBtn.disabled = true;
                }
            } else {
                // Upgrade
                if (actionBtn && planType !== 'free') {
                    actionBtn.textContent = `Upgrade to ${planType.charAt(0).toUpperCase() + planType.slice(1)}`;
                }
            }
        });
    }

    isPlanDowngrade(currentTier, targetTier) {
        const tierHierarchy = { 'free': 0, 'pro': 1, 'premium': 2 };
        return tierHierarchy[currentTier] > tierHierarchy[targetTier];
    }

    updateAccountInfo(user) {
        const userEmailElement = document.getElementById('userEmail');
        const memberSinceElement = document.getElementById('memberSince');
        const subscriptionStatusElement = document.getElementById('subscriptionStatusText');

        if (userEmailElement) {
            userEmailElement.textContent = user.email;
        }

        if (memberSinceElement) {
            const createdAt = new Date(user.created_at);
            memberSinceElement.textContent = createdAt.toLocaleDateString();
        }

        if (subscriptionStatusElement) {
            if (this.currentSubscription) {
                const status = this.currentSubscription.is_active ? 'Active' : 'Inactive';
                const tier = this.currentSubscription.tier.charAt(0).toUpperCase() + this.currentSubscription.tier.slice(1);
                subscriptionStatusElement.textContent = `${tier} (${status})`;
            }
        }
    }

    async handleUpgrade(planType) {
        try {
            const upgradeBtn = document.querySelector(`[data-plan="${planType}"]`);
            const originalText = upgradeBtn.textContent;
            
            upgradeBtn.textContent = 'Processing...';
            upgradeBtn.disabled = true;

            // Create checkout session
            const response = await this.store.apiCall('/payments/create-checkout-session', {
                method: 'POST',
                body: JSON.stringify({ plan_type: planType })
            });

            // Redirect to Stripe checkout
            window.location.href = response.checkout_url;

        } catch (error) {
            console.error('Upgrade error:', error);
            ErrorHandler.show(error.message || 'Failed to start upgrade process');
            
            // Reset button
            const upgradeBtn = document.querySelector(`[data-plan="${planType}"]`);
            if (upgradeBtn) {
                upgradeBtn.textContent = `Upgrade to ${planType.charAt(0).toUpperCase() + planType.slice(1)}`;
                upgradeBtn.disabled = false;
            }
        }
    }

    async handleCancelSubscription() {
        if (!confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.')) {
            return;
        }

        try {
            const cancelBtn = document.getElementById('cancelSubscriptionBtn');
            const originalText = cancelBtn.textContent;
            
            cancelBtn.textContent = 'Canceling...';
            cancelBtn.disabled = true;

            await this.store.apiCall('/payments/subscription/cancel', {
                method: 'POST'
            });

            ErrorHandler.show('Subscription canceled successfully', 'success');
            
            // Reload subscription data
            await this.loadSubscriptionData();

        } catch (error) {
            console.error('Cancel subscription error:', error);
            ErrorHandler.show(error.message || 'Failed to cancel subscription');
            
            // Reset button
            const cancelBtn = document.getElementById('cancelSubscriptionBtn');
            if (cancelBtn) {
                cancelBtn.textContent = 'Cancel Subscription';
                cancelBtn.disabled = false;
            }
        }
    }

    showChangePasswordModal() {
        // Create modal for password change
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Change Password</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <form id="changePasswordForm" class="modal-form">
                    <div class="form-group">
                        <label for="currentPassword">Current Password</label>
                        <input type="password" id="currentPassword" name="currentPassword" required>
                    </div>
                    <div class="form-group">
                        <label for="newPassword">New Password</label>
                        <input type="password" id="newPassword" name="newPassword" required minlength="6">
                    </div>
                    <div class="form-group">
                        <label for="confirmNewPassword">Confirm New Password</label>
                        <input type="password" id="confirmNewPassword" name="confirmNewPassword" required minlength="6">
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn-secondary modal-cancel">Cancel</button>
                        <button type="submit" class="btn-primary">Change Password</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        // Add modal styles if not already present
        if (!document.querySelector('#modal-styles')) {
            const styles = document.createElement('style');
            styles.id = 'modal-styles';
            styles.textContent = `
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                }
                .modal-content {
                    background: rgba(22, 32, 51, 0.95);
                    border: 1px solid rgba(99, 102, 241, 0.3);
                    border-radius: 12px;
                    padding: 24px;
                    max-width: 400px;
                    width: 90%;
                    max-height: 90vh;
                    overflow-y: auto;
                }
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                .modal-header h3 {
                    color: #e4e8f1;
                    margin: 0;
                }
                .modal-close {
                    background: none;
                    border: none;
                    color: #9ca3af;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .modal-close:hover {
                    color: #e4e8f1;
                }
                .modal-form {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .modal-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    margin-top: 20px;
                }
                .btn-primary {
                    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    padding: 8px 16px;
                    cursor: pointer;
                    font-weight: 500;
                }
                .btn-secondary {
                    background: rgba(99, 102, 241, 0.1);
                    color: #6366f1;
                    border: 1px solid rgba(99, 102, 241, 0.3);
                    border-radius: 6px;
                    padding: 8px 16px;
                    cursor: pointer;
                    font-weight: 500;
                }
            `;
            document.head.appendChild(styles);
        }

        // Handle modal events
        const closeModal = () => modal.remove();
        
        modal.querySelector('.modal-close').addEventListener('click', closeModal);
        modal.querySelector('.modal-cancel').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // Handle form submission
        modal.querySelector('#changePasswordForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const form = e.target;
            const currentPassword = form.currentPassword.value;
            const newPassword = form.newPassword.value;
            const confirmNewPassword = form.confirmNewPassword.value;
            
            if (newPassword !== confirmNewPassword) {
                ErrorHandler.show('New passwords do not match');
                return;
            }

            try {
                const submitBtn = form.querySelector('button[type="submit"]');
                const originalText = submitBtn.textContent;
                submitBtn.textContent = 'Changing...';
                submitBtn.disabled = true;

                await this.store.apiCall('/auth/change-password', {
                    method: 'POST',
                    body: JSON.stringify({
                        currentPassword,
                        newPassword
                    })
                });

                ErrorHandler.show('Password changed successfully!', 'success');
                closeModal();

            } catch (error) {
                ErrorHandler.show(error.message || 'Failed to change password');
                
                const submitBtn = form.querySelector('button[type="submit"]');
                submitBtn.textContent = 'Change Password';
                submitBtn.disabled = false;
            }
        });
    }
}

// Initialize subscription manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize on account page
    if (window.location.pathname.includes('account')) {
        window.subscriptionManager = new SubscriptionManager();
    }
});

