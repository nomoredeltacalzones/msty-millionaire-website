// Loading Component
// Handles loading states and spinners throughout the application

class LoadingComponent {
    constructor() {
        this.activeLoaders = new Set();
        this.defaultOptions = {
            overlay: true,
            message: 'Loading...',
            spinner: 'default',
            backdrop: true,
            timeout: 30000 // 30 seconds
        };
        
        this.createLoadingStyles();
    }

    createLoadingStyles() {
        if (document.getElementById('loading-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'loading-styles';
        styles.textContent = `
            .loading-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(10, 14, 26, 0.8);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                opacity: 0;
                transition: opacity 0.3s ease;
            }

            .loading-overlay.show {
                opacity: 1;
            }

            .loading-container {
                background: rgba(15, 23, 42, 0.95);
                border: 1px solid rgba(139, 92, 246, 0.3);
                border-radius: 12px;
                padding: 2rem;
                text-align: center;
                min-width: 200px;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            }

            .loading-spinner {
                width: 40px;
                height: 40px;
                margin: 0 auto 1rem;
                position: relative;
            }

            .loading-spinner.default {
                border: 3px solid rgba(139, 92, 246, 0.3);
                border-top: 3px solid #8b5cf6;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            .loading-spinner.dots {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .loading-spinner.dots::before,
            .loading-spinner.dots::after,
            .loading-spinner.dots {
                content: '';
                width: 8px;
                height: 8px;
                background: #8b5cf6;
                border-radius: 50%;
                animation: loading-dots 1.4s ease-in-out infinite both;
            }

            .loading-spinner.dots::before {
                animation-delay: -0.32s;
            }

            .loading-spinner.dots::after {
                animation-delay: -0.16s;
            }

            .loading-spinner.pulse {
                background: #8b5cf6;
                border-radius: 50%;
                animation: loading-pulse 1.5s ease-in-out infinite;
            }

            .loading-message {
                color: #e4e8f1;
                font-size: 1rem;
                font-weight: 500;
                margin: 0;
            }

            .loading-progress {
                width: 100%;
                height: 4px;
                background: rgba(139, 92, 246, 0.3);
                border-radius: 2px;
                margin-top: 1rem;
                overflow: hidden;
            }

            .loading-progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #8b5cf6, #a855f7);
                border-radius: 2px;
                transition: width 0.3s ease;
            }

            .loading-inline {
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                color: #8b5cf6;
                font-size: 0.875rem;
            }

            .loading-inline .loading-spinner {
                width: 16px;
                height: 16px;
                margin: 0;
            }

            .loading-button {
                position: relative;
                overflow: hidden;
            }

            .loading-button.loading {
                color: transparent !important;
                pointer-events: none;
            }

            .loading-button.loading::after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 16px;
                height: 16px;
                margin: -8px 0 0 -8px;
                border: 2px solid transparent;
                border-top: 2px solid currentColor;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            @keyframes loading-dots {
                0%, 80%, 100% {
                    transform: scale(0);
                    opacity: 0.5;
                }
                40% {
                    transform: scale(1);
                    opacity: 1;
                }
            }

            @keyframes loading-pulse {
                0%, 100% {
                    transform: scale(0.8);
                    opacity: 0.5;
                }
                50% {
                    transform: scale(1.2);
                    opacity: 1;
                }
            }

            .loading-skeleton {
                background: linear-gradient(90deg, rgba(139, 92, 246, 0.1) 25%, rgba(139, 92, 246, 0.2) 50%, rgba(139, 92, 246, 0.1) 75%);
                background-size: 200% 100%;
                animation: loading-skeleton 1.5s infinite;
                border-radius: 4px;
            }

            @keyframes loading-skeleton {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
        `;
        
        document.head.appendChild(styles);
    }

    // Show full-screen loading overlay
    show(options = {}) {
        const config = { ...this.defaultOptions, ...options };
        const loaderId = this.generateId();
        
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.id = `loading-${loaderId}`;
        
        const container = document.createElement('div');
        container.className = 'loading-container';
        
        const spinner = document.createElement('div');
        spinner.className = `loading-spinner ${config.spinner}`;
        
        const message = document.createElement('p');
        message.className = 'loading-message';
        message.textContent = config.message;
        
        container.appendChild(spinner);
        container.appendChild(message);
        
        // Add progress bar if specified
        if (config.progress !== undefined) {
            const progressContainer = document.createElement('div');
            progressContainer.className = 'loading-progress';
            
            const progressBar = document.createElement('div');
            progressBar.className = 'loading-progress-bar';
            progressBar.style.width = `${config.progress}%`;
            
            progressContainer.appendChild(progressBar);
            container.appendChild(progressContainer);
        }
        
        overlay.appendChild(container);
        document.body.appendChild(overlay);
        
        // Trigger animation
        requestAnimationFrame(() => {
            overlay.classList.add('show');
        });
        
        this.activeLoaders.add(loaderId);
        
        // Auto-hide after timeout
        if (config.timeout) {
            setTimeout(() => {
                this.hide(loaderId);
            }, config.timeout);
        }
        
        return loaderId;
    }

    // Hide loading overlay
    hide(loaderId) {
        const overlay = document.getElementById(`loading-${loaderId}`);
        if (overlay) {
            overlay.classList.remove('show');
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }, 300);
        }
        
        this.activeLoaders.delete(loaderId);
    }

    // Hide all loading overlays
    hideAll() {
        this.activeLoaders.forEach(loaderId => {
            this.hide(loaderId);
        });
    }

    // Update loading message
    updateMessage(loaderId, message) {
        const overlay = document.getElementById(`loading-${loaderId}`);
        if (overlay) {
            const messageElement = overlay.querySelector('.loading-message');
            if (messageElement) {
                messageElement.textContent = message;
            }
        }
    }

    // Update progress
    updateProgress(loaderId, progress) {
        const overlay = document.getElementById(`loading-${loaderId}`);
        if (overlay) {
            const progressBar = overlay.querySelector('.loading-progress-bar');
            if (progressBar) {
                progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
            }
        }
    }

    // Show inline loading
    showInline(element, options = {}) {
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }
        
        if (!element) return null;
        
        const config = { message: 'Loading...', ...options };
        const loaderId = this.generateId();
        
        const loadingElement = document.createElement('span');
        loadingElement.className = 'loading-inline';
        loadingElement.id = `loading-inline-${loaderId}`;
        
        const spinner = document.createElement('span');
        spinner.className = 'loading-spinner default';
        
        const message = document.createElement('span');
        message.textContent = config.message;
        
        loadingElement.appendChild(spinner);
        loadingElement.appendChild(message);
        
        // Store original content
        element.dataset.originalContent = element.innerHTML;
        element.innerHTML = '';
        element.appendChild(loadingElement);
        
        this.activeLoaders.add(loaderId);
        return loaderId;
    }

    // Hide inline loading
    hideInline(loaderId) {
        const loadingElement = document.getElementById(`loading-inline-${loaderId}`);
        if (loadingElement && loadingElement.parentElement) {
            const parent = loadingElement.parentElement;
            const originalContent = parent.dataset.originalContent;
            
            if (originalContent) {
                parent.innerHTML = originalContent;
                delete parent.dataset.originalContent;
            }
        }
        
        this.activeLoaders.delete(loaderId);
    }

    // Show button loading state
    showButton(button, options = {}) {
        if (typeof button === 'string') {
            button = document.querySelector(button);
        }
        
        if (!button) return null;
        
        const loaderId = this.generateId();
        
        // Store original state
        button.dataset.originalText = button.textContent;
        button.dataset.originalDisabled = button.disabled;
        button.dataset.loaderId = loaderId;
        
        // Apply loading state
        button.classList.add('loading-button', 'loading');
        button.disabled = true;
        
        if (options.message) {
            button.textContent = options.message;
        }
        
        this.activeLoaders.add(loaderId);
        return loaderId;
    }

    // Hide button loading state
    hideButton(loaderId) {
        const button = document.querySelector(`[data-loader-id="${loaderId}"]`);
        if (button) {
            button.classList.remove('loading-button', 'loading');
            
            // Restore original state
            if (button.dataset.originalText) {
                button.textContent = button.dataset.originalText;
                delete button.dataset.originalText;
            }
            
            if (button.dataset.originalDisabled !== undefined) {
                button.disabled = button.dataset.originalDisabled === 'true';
                delete button.dataset.originalDisabled;
            }
            
            delete button.dataset.loaderId;
        }
        
        this.activeLoaders.delete(loaderId);
    }

    // Create skeleton loading
    createSkeleton(element, options = {}) {
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }
        
        if (!element) return null;
        
        const config = {
            lines: 3,
            height: '1rem',
            spacing: '0.5rem',
            ...options
        };
        
        const skeleton = document.createElement('div');
        skeleton.className = 'loading-skeleton-container';
        
        for (let i = 0; i < config.lines; i++) {
            const line = document.createElement('div');
            line.className = 'loading-skeleton';
            line.style.height = config.height;
            line.style.marginBottom = i < config.lines - 1 ? config.spacing : '0';
            
            // Vary width for more realistic skeleton
            if (i === config.lines - 1) {
                line.style.width = '60%';
            }
            
            skeleton.appendChild(line);
        }
        
        // Store original content
        element.dataset.originalContent = element.innerHTML;
        element.innerHTML = '';
        element.appendChild(skeleton);
        
        const loaderId = this.generateId();
        skeleton.dataset.loaderId = loaderId;
        this.activeLoaders.add(loaderId);
        
        return loaderId;
    }

    // Hide skeleton loading
    hideSkeleton(loaderId) {
        const skeleton = document.querySelector(`[data-loader-id="${loaderId}"]`);
        if (skeleton && skeleton.parentElement) {
            const parent = skeleton.parentElement;
            const originalContent = parent.dataset.originalContent;
            
            if (originalContent) {
                parent.innerHTML = originalContent;
                delete parent.dataset.originalContent;
            }
        }
        
        this.activeLoaders.delete(loaderId);
    }

    // Utility methods
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    isLoading(loaderId) {
        return this.activeLoaders.has(loaderId);
    }

    getActiveLoaders() {
        return Array.from(this.activeLoaders);
    }

    // Promise wrapper for loading states
    async withLoading(promise, options = {}) {
        const loaderId = this.show(options);
        
        try {
            const result = await promise;
            this.hide(loaderId);
            return result;
        } catch (error) {
            this.hide(loaderId);
            throw error;
        }
    }

    // Auto-loading for forms
    setupFormLoading(form, options = {}) {
        if (typeof form === 'string') {
            form = document.querySelector(form);
        }
        
        if (!form) return;
        
        form.addEventListener('submit', (e) => {
            const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
            if (submitButton) {
                this.showButton(submitButton, options);
            }
        });
    }

    // Auto-loading for AJAX requests
    setupAjaxLoading() {
        const originalFetch = window.fetch;
        const loadingComponent = this;
        
        window.fetch = function(...args) {
            const loaderId = loadingComponent.show({
                message: 'Loading...',
                spinner: 'default'
            });
            
            return originalFetch.apply(this, args)
                .finally(() => {
                    loadingComponent.hide(loaderId);
                });
        };
    }
}

// Create global loading instance
window.loading = new LoadingComponent();

// Auto-setup for common scenarios
document.addEventListener('DOMContentLoaded', () => {
    // Setup form loading for all forms with data-loading attribute
    document.querySelectorAll('form[data-loading]').forEach(form => {
        window.loading.setupFormLoading(form);
    });
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoadingComponent;
}

