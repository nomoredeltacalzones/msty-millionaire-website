// Analytics Tracking for MSTY Millionaire
// Handles user behavior tracking and analytics

class AnalyticsTracker {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.userId = null;
        this.events = [];
        this.pageViews = [];
        this.startTime = Date.now();
        this.isEnabled = true;
        
        this.setupTracking();
        this.trackPageView();
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    setupTracking() {
        // Track page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.trackEvent('page_hidden', { timestamp: Date.now() });
            } else {
                this.trackEvent('page_visible', { timestamp: Date.now() });
            }
        });

        // Track clicks on important elements
        document.addEventListener('click', (e) => {
            this.trackClick(e);
        });

        // Track form submissions
        document.addEventListener('submit', (e) => {
            this.trackFormSubmission(e);
        });

        // Track scroll depth
        this.setupScrollTracking();

        // Track time on page
        this.setupTimeTracking();

        // Send analytics data periodically
        setInterval(() => {
            this.sendAnalytics();
        }, 30000); // Every 30 seconds

        // Send analytics before page unload
        window.addEventListener('beforeunload', () => {
            this.sendAnalytics(true);
        });
    }

    setUserId(userId) {
        this.userId = userId;
        this.trackEvent('user_identified', { userId });
    }

    trackPageView(page = window.location.pathname) {
        const pageView = {
            page,
            title: document.title,
            referrer: document.referrer,
            timestamp: Date.now(),
            sessionId: this.sessionId,
            userId: this.userId,
            userAgent: navigator.userAgent,
            screenResolution: `${screen.width}x${screen.height}`,
            viewportSize: `${window.innerWidth}x${window.innerHeight}`
        };

        this.pageViews.push(pageView);
        this.trackEvent('page_view', pageView);
    }

    trackEvent(eventName, properties = {}) {
        if (!this.isEnabled) return;

        const event = {
            event: eventName,
            properties: {
                ...properties,
                page: window.location.pathname,
                timestamp: Date.now(),
                sessionId: this.sessionId,
                userId: this.userId
            }
        };

        this.events.push(event);
        console.log('Analytics event:', event);
    }

    trackClick(event) {
        const element = event.target;
        const tagName = element.tagName.toLowerCase();
        
        // Track important clicks
        if (tagName === 'a' || tagName === 'button' || element.classList.contains('trackable')) {
            const properties = {
                element: tagName,
                text: element.textContent?.trim().substring(0, 100),
                href: element.href,
                className: element.className,
                id: element.id
            };

            // Special tracking for specific elements
            if (element.classList.contains('nav-link')) {
                this.trackEvent('navigation_click', properties);
            } else if (element.classList.contains('cta-button')) {
                this.trackEvent('cta_click', properties);
            } else if (element.classList.contains('calculator-button')) {
                this.trackEvent('calculator_interaction', properties);
            } else if (element.classList.contains('auth-button')) {
                this.trackEvent('auth_interaction', properties);
            } else {
                this.trackEvent('click', properties);
            }
        }
    }

    trackFormSubmission(event) {
        const form = event.target;
        const formId = form.id || form.className;
        
        this.trackEvent('form_submission', {
            formId,
            action: form.action,
            method: form.method
        });
    }

    setupScrollTracking() {
        let maxScroll = 0;
        let scrollMilestones = [25, 50, 75, 90, 100];
        let trackedMilestones = new Set();

        const trackScroll = () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrollPercent = Math.round((scrollTop / documentHeight) * 100);

            if (scrollPercent > maxScroll) {
                maxScroll = scrollPercent;
            }

            // Track scroll milestones
            scrollMilestones.forEach(milestone => {
                if (scrollPercent >= milestone && !trackedMilestones.has(milestone)) {
                    trackedMilestones.add(milestone);
                    this.trackEvent('scroll_milestone', {
                        milestone,
                        maxScroll: scrollPercent
                    });
                }
            });
        };

        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(trackScroll, 100);
        });
    }

    setupTimeTracking() {
        // Track time spent on page
        setInterval(() => {
            const timeOnPage = Date.now() - this.startTime;
            
            // Track engagement milestones
            if (timeOnPage > 30000 && !this.tracked30s) { // 30 seconds
                this.trackEvent('engagement_30s');
                this.tracked30s = true;
            }
            if (timeOnPage > 60000 && !this.tracked1m) { // 1 minute
                this.trackEvent('engagement_1m');
                this.tracked1m = true;
            }
            if (timeOnPage > 300000 && !this.tracked5m) { // 5 minutes
                this.trackEvent('engagement_5m');
                this.tracked5m = true;
            }
        }, 5000);
    }

    // Business-specific tracking methods
    trackCalculatorUsage(calculatorType, inputs, results) {
        this.trackEvent('calculator_usage', {
            calculatorType,
            inputs,
            results,
            timestamp: Date.now()
        });
    }

    trackPortfolioAction(action, details) {
        this.trackEvent('portfolio_action', {
            action, // 'add_holding', 'remove_holding', 'update_holding'
            details,
            timestamp: Date.now()
        });
    }

    trackEducationEngagement(contentType, contentId, action) {
        this.trackEvent('education_engagement', {
            contentType, // 'article', 'video', 'guide'
            contentId,
            action, // 'view', 'complete', 'share'
            timestamp: Date.now()
        });
    }

    trackSubscriptionEvent(event, planType) {
        this.trackEvent('subscription_event', {
            event, // 'upgrade_initiated', 'upgrade_completed', 'cancelled'
            planType,
            timestamp: Date.now()
        });
    }

    trackSearchQuery(query, results) {
        this.trackEvent('search', {
            query,
            resultsCount: results?.length || 0,
            timestamp: Date.now()
        });
    }

    trackError(error, context) {
        this.trackEvent('error', {
            message: error.message,
            stack: error.stack,
            context,
            timestamp: Date.now()
        });
    }

    // Performance tracking
    trackPerformance() {
        if ('performance' in window) {
            const navigation = performance.getEntriesByType('navigation')[0];
            if (navigation) {
                this.trackEvent('performance', {
                    loadTime: navigation.loadEventEnd - navigation.loadEventStart,
                    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                    firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime,
                    firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime
                });
            }
        }
    }

    // Send analytics data to backend
    async sendAnalytics(isBeforeUnload = false) {
        if (this.events.length === 0) return;

        const payload = {
            sessionId: this.sessionId,
            userId: this.userId,
            events: [...this.events],
            pageViews: [...this.pageViews],
            timestamp: Date.now()
        };

        try {
            if (isBeforeUnload && 'sendBeacon' in navigator) {
                // Use sendBeacon for reliable delivery during page unload
                navigator.sendBeacon('/api/analytics', JSON.stringify(payload));
            } else {
                // Use regular fetch for normal sends
                await fetch('/api/analytics', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
            }

            // Clear sent events
            this.events = [];
            this.pageViews = [];

        } catch (error) {
            console.error('Failed to send analytics:', error);
        }
    }

    // Privacy controls
    enableTracking() {
        this.isEnabled = true;
        this.trackEvent('tracking_enabled');
    }

    disableTracking() {
        this.isEnabled = false;
        this.trackEvent('tracking_disabled');
        this.sendAnalytics(); // Send final batch
    }

    // GDPR compliance
    hasConsent() {
        return localStorage.getItem('analytics_consent') === 'true';
    }

    setConsent(hasConsent) {
        localStorage.setItem('analytics_consent', hasConsent.toString());
        if (hasConsent) {
            this.enableTracking();
        } else {
            this.disableTracking();
        }
    }

    // Debug methods
    getSessionData() {
        return {
            sessionId: this.sessionId,
            userId: this.userId,
            events: this.events,
            pageViews: this.pageViews,
            isEnabled: this.isEnabled
        };
    }

    clearData() {
        this.events = [];
        this.pageViews = [];
    }
}

// Create global analytics instance
window.analytics = new AnalyticsTracker();

// Check for consent on load
document.addEventListener('DOMContentLoaded', () => {
    if (!window.analytics.hasConsent()) {
        // Show consent banner or disable tracking
        window.analytics.disableTracking();
    }
    
    // Track performance metrics
    window.addEventListener('load', () => {
        setTimeout(() => {
            window.analytics.trackPerformance();
        }, 1000);
    });
});

// Track user login
document.addEventListener('user-login', (event) => {
    if (event.detail?.userId) {
        window.analytics.setUserId(event.detail.userId);
    }
});

// Track page changes for SPA
let currentPage = window.location.pathname;
setInterval(() => {
    if (window.location.pathname !== currentPage) {
        currentPage = window.location.pathname;
        window.analytics.trackPageView();
    }
}, 1000);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalyticsTracker;
}

