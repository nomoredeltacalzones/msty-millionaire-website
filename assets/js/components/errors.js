// Error Component
// Handles error display and management throughout the application

class ErrorComponent {
    constructor() {
        this.activeErrors = new Map();
        this.errorQueue = [];
        this.maxErrors = 5;
        this.defaultOptions = {
            type: 'error',
            duration: 5000,
            dismissible: true,
            position: 'top-right',
            showIcon: true,
            showTimestamp: false
        };
        
        this.createErrorStyles();
        this.createErrorContainer();
    }

    createErrorStyles() {
        if (document.getElementById('error-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'error-styles';
        styles.textContent = `
            .error-container {
                position: fixed;
                z-index: 10000;
                pointer-events: none;
                max-width: 400px;
            }

            .error-container.top-right {
                top: 1rem;
                right: 1rem;
            }

            .error-container.top-left {
                top: 1rem;
                left: 1rem;
            }

            .error-container.bottom-right {
                bottom: 1rem;
                right: 1rem;
            }

            .error-container.bottom-left {
                bottom: 1rem;
                left: 1rem;
            }

            .error-container.top-center {
                top: 1rem;
                left: 50%;
                transform: translateX(-50%);
            }

            .error-container.bottom-center {
                bottom: 1rem;
                left: 50%;
                transform: translateX(-50%);
            }

            .error-notification {
                background: rgba(15, 23, 42, 0.95);
                border-radius: 8px;
                padding: 1rem;
                margin-bottom: 0.5rem;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                border-left: 4px solid;
                pointer-events: auto;
                transform: translateX(100%);
                opacity: 0;
                transition: all 0.3s ease;
                max-width: 100%;
                word-wrap: break-word;
            }

            .error-notification.show {
                transform: translateX(0);
                opacity: 1;
            }

            .error-notification.error {
                border-left-color: #ef4444;
                background: rgba(15, 23, 42, 0.95);
            }

            .error-notification.warning {
                border-left-color: #f59e0b;
                background: rgba(15, 23, 42, 0.95);
            }

            .error-notification.success {
                border-left-color: #10b981;
                background: rgba(15, 23, 42, 0.95);
            }

            .error-notification.info {
                border-left-color: #3b82f6;
                background: rgba(15, 23, 42, 0.95);
            }

            .error-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                margin-bottom: 0.5rem;
            }

            .error-title-container {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                flex: 1;
            }

            .error-icon {
                width: 20px;
                height: 20px;
                flex-shrink: 0;
            }

            .error-icon.error {
                color: #ef4444;
            }

            .error-icon.warning {
                color: #f59e0b;
            }

            .error-icon.success {
                color: #10b981;
            }

            .error-icon.info {
                color: #3b82f6;
            }

            .error-title {
                font-weight: 600;
                color: #e4e8f1;
                margin: 0;
                font-size: 0.875rem;
            }

            .error-close {
                background: none;
                border: none;
                color: #9ca3af;
                cursor: pointer;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                transition: all 0.2s ease;
                flex-shrink: 0;
            }

            .error-close:hover {
                background: rgba(156, 163, 175, 0.1);
                color: #e4e8f1;
            }

            .error-message {
                color: #d1d5db;
                margin: 0;
                font-size: 0.875rem;
                line-height: 1.4;
            }

            .error-details {
                margin-top: 0.5rem;
                padding-top: 0.5rem;
                border-top: 1px solid rgba(156, 163, 175, 0.2);
            }

            .error-details summary {
                color: #9ca3af;
                cursor: pointer;
                font-size: 0.75rem;
                margin-bottom: 0.5rem;
            }

            .error-details pre {
                background: rgba(0, 0, 0, 0.3);
                padding: 0.5rem;
                border-radius: 4px;
                font-size: 0.75rem;
                color: #d1d5db;
                overflow-x: auto;
                margin: 0;
                white-space: pre-wrap;
            }

            .error-timestamp {
                color: #6b7280;
                font-size: 0.75rem;
                margin-top: 0.5rem;
            }

            .error-actions {
                margin-top: 0.75rem;
                display: flex;
                gap: 0.5rem;
            }

            .error-action {
                background: rgba(139, 92, 246, 0.1);
                border: 1px solid rgba(139, 92, 246, 0.3);
                color: #a855f7;
                padding: 0.25rem 0.75rem;
                border-radius: 4px;
                font-size: 0.75rem;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .error-action:hover {
                background: rgba(139, 92, 246, 0.2);
                border-color: rgba(139, 92, 246, 0.5);
            }

            .error-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 2px;
                background: currentColor;
                opacity: 0.3;
                transition: width linear;
            }

            .error-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
                opacity: 0;
                transition: opacity 0.3s ease;
            }

            .error-modal.show {
                opacity: 1;
            }

            .error-modal-content {
                background: rgba(15, 23, 42, 0.98);
                border: 1px solid rgba(139, 92, 246, 0.3);
                border-radius: 12px;
                padding: 2rem;
                max-width: 500px;
                max-height: 80vh;
                overflow-y: auto;
                margin: 1rem;
            }

            .error-modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 1rem;
                padding-bottom: 1rem;
                border-bottom: 1px solid rgba(156, 163, 175, 0.2);
            }

            .error-modal-title {
                color: #e4e8f1;
                font-size: 1.25rem;
                font-weight: 600;
                margin: 0;
            }

            .error-modal-body {
                color: #d1d5db;
                line-height: 1.6;
            }

            @media (max-width: 640px) {
                .error-container {
                    left: 1rem !important;
                    right: 1rem !important;
                    max-width: none;
                    transform: none !important;
                }

                .error-notification {
                    transform: translateY(-100%);
                }

                .error-notification.show {
                    transform: translateY(0);
                }
            }
        `;
        
        document.head.appendChild(styles);
    }

    createErrorContainer() {
        this.container = document.createElement('div');
        this.container.className = 'error-container top-right';
        this.container.id = 'error-container';
        document.body.appendChild(this.container);
    }

    // Show error notification
    show(message, options = {}) {
        const config = { ...this.defaultOptions, ...options };
        const errorId = this.generateId();
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `error-notification ${config.type}`;
        notification.id = `error-${errorId}`;
        
        // Create header
        const header = document.createElement('div');
        header.className = 'error-header';
        
        const titleContainer = document.createElement('div');
        titleContainer.className = 'error-title-container';
        
        // Add icon if enabled
        if (config.showIcon) {
            const icon = document.createElement('div');
            icon.className = `error-icon ${config.type}`;
            icon.innerHTML = this.getIcon(config.type);
            titleContainer.appendChild(icon);
        }
        
        // Add title
        const title = document.createElement('h4');
        title.className = 'error-title';
        title.textContent = config.title || this.getDefaultTitle(config.type);
        titleContainer.appendChild(title);
        
        header.appendChild(titleContainer);
        
        // Add close button if dismissible
        if (config.dismissible) {
            const closeButton = document.createElement('button');
            closeButton.className = 'error-close';
            closeButton.innerHTML = '×';
            closeButton.onclick = () => this.hide(errorId);
            header.appendChild(closeButton);
        }
        
        notification.appendChild(header);
        
        // Add message
        const messageElement = document.createElement('p');
        messageElement.className = 'error-message';
        messageElement.textContent = message;
        notification.appendChild(messageElement);
        
        // Add details if provided
        if (config.details) {
            const details = document.createElement('details');
            details.className = 'error-details';
            
            const summary = document.createElement('summary');
            summary.textContent = 'Show Details';
            details.appendChild(summary);
            
            const pre = document.createElement('pre');
            pre.textContent = typeof config.details === 'string' ? config.details : JSON.stringify(config.details, null, 2);
            details.appendChild(pre);
            
            notification.appendChild(details);
        }
        
        // Add timestamp if enabled
        if (config.showTimestamp) {
            const timestamp = document.createElement('div');
            timestamp.className = 'error-timestamp';
            timestamp.textContent = new Date().toLocaleTimeString();
            notification.appendChild(timestamp);
        }
        
        // Add actions if provided
        if (config.actions && config.actions.length > 0) {
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'error-actions';
            
            config.actions.forEach(action => {
                const button = document.createElement('button');
                button.className = 'error-action';
                button.textContent = action.label;
                button.onclick = () => {
                    action.handler();
                    if (action.dismiss !== false) {
                        this.hide(errorId);
                    }
                };
                actionsContainer.appendChild(button);
            });
            
            notification.appendChild(actionsContainer);
        }
        
        // Add progress bar for timed notifications
        if (config.duration > 0) {
            const progress = document.createElement('div');
            progress.className = 'error-progress';
            progress.style.width = '100%';
            notification.appendChild(progress);
            
            // Animate progress
            requestAnimationFrame(() => {
                progress.style.transition = `width ${config.duration}ms linear`;
                progress.style.width = '0%';
            });
        }
        
        // Add to container
        this.container.appendChild(notification);
        
        // Update container position if needed
        if (config.position !== this.container.className.split(' ')[1]) {
            this.container.className = `error-container ${config.position}`;
        }
        
        // Show notification
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });
        
        // Store error info
        this.activeErrors.set(errorId, {
            element: notification,
            config,
            timestamp: Date.now()
        });
        
        // Auto-hide if duration is set
        if (config.duration > 0) {
            setTimeout(() => {
                this.hide(errorId);
            }, config.duration);
        }
        
        // Limit number of errors
        this.limitErrors();
        
        return errorId;
    }

    // Hide error notification
    hide(errorId) {
        const errorInfo = this.activeErrors.get(errorId);
        if (errorInfo) {
            const { element } = errorInfo;
            element.classList.remove('show');
            
            setTimeout(() => {
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
            }, 300);
            
            this.activeErrors.delete(errorId);
        }
    }

    // Hide all errors
    hideAll() {
        this.activeErrors.forEach((_, errorId) => {
            this.hide(errorId);
        });
    }

    // Show modal error
    showModal(message, options = {}) {
        const config = { ...this.defaultOptions, ...options };
        
        const modal = document.createElement('div');
        modal.className = 'error-modal';
        
        const content = document.createElement('div');
        content.className = 'error-modal-content';
        
        const header = document.createElement('div');
        header.className = 'error-modal-header';
        
        const title = document.createElement('h3');
        title.className = 'error-modal-title';
        title.textContent = config.title || this.getDefaultTitle(config.type);
        
        const closeButton = document.createElement('button');
        closeButton.className = 'error-close';
        closeButton.innerHTML = '×';
        closeButton.onclick = () => {
            modal.classList.remove('show');
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        };
        
        header.appendChild(title);
        header.appendChild(closeButton);
        
        const body = document.createElement('div');
        body.className = 'error-modal-body';
        body.innerHTML = message;
        
        content.appendChild(header);
        content.appendChild(body);
        modal.appendChild(content);
        
        document.body.appendChild(modal);
        
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
        
        return modal;
    }

    // Convenience methods
    error(message, options = {}) {
        return this.show(message, { ...options, type: 'error' });
    }

    warning(message, options = {}) {
        return this.show(message, { ...options, type: 'warning' });
    }

    success(message, options = {}) {
        return this.show(message, { ...options, type: 'success' });
    }

    info(message, options = {}) {
        return this.show(message, { ...options, type: 'info' });
    }

    // Handle API errors
    handleApiError(error, context = '') {
        let message = 'An unexpected error occurred';
        let details = null;
        
        if (error.response) {
            // HTTP error response
            message = error.response.data?.message || `HTTP ${error.response.status}: ${error.response.statusText}`;
            details = error.response.data;
        } else if (error.request) {
            // Network error
            message = 'Network error - please check your connection';
            details = 'No response received from server';
        } else if (error.message) {
            // Other error
            message = error.message;
            details = error.stack;
        }
        
        return this.error(message, {
            title: context ? `${context} Error` : 'API Error',
            details,
            actions: [
                {
                    label: 'Retry',
                    handler: () => window.location.reload()
                }
            ]
        });
    }

    // Handle validation errors
    handleValidationErrors(errors, formElement = null) {
        if (Array.isArray(errors)) {
            errors.forEach(error => {
                this.error(error.message || error, {
                    title: 'Validation Error',
                    duration: 3000
                });
            });
        } else if (typeof errors === 'object') {
            Object.entries(errors).forEach(([field, message]) => {
                this.error(`${field}: ${message}`, {
                    title: 'Validation Error',
                    duration: 3000
                });
                
                // Highlight field if form is provided
                if (formElement) {
                    const fieldElement = formElement.querySelector(`[name="${field}"]`);
                    if (fieldElement) {
                        fieldElement.classList.add('error');
                        setTimeout(() => {
                            fieldElement.classList.remove('error');
                        }, 3000);
                    }
                }
            });
        } else {
            this.error(errors, {
                title: 'Validation Error',
                duration: 3000
            });
        }
    }

    // Utility methods
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    getIcon(type) {
        const icons = {
            error: '⚠️',
            warning: '⚠️',
            success: '✅',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    getDefaultTitle(type) {
        const titles = {
            error: 'Error',
            warning: 'Warning',
            success: 'Success',
            info: 'Information'
        };
        return titles[type] || titles.info;
    }

    limitErrors() {
        if (this.activeErrors.size > this.maxErrors) {
            const oldestError = Array.from(this.activeErrors.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
            
            if (oldestError) {
                this.hide(oldestError[0]);
            }
        }
    }

    // Global error handler
    setupGlobalErrorHandler() {
        window.addEventListener('error', (event) => {
            this.error('JavaScript Error', {
                title: 'Script Error',
                details: `${event.message}\nFile: ${event.filename}\nLine: ${event.lineno}`,
                duration: 0 // Don't auto-hide
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.error('Unhandled Promise Rejection', {
                title: 'Promise Error',
                details: event.reason?.stack || event.reason,
                duration: 0 // Don't auto-hide
            });
        });
    }
}

// Create global error instance
window.errorHandler = new ErrorComponent();

// Setup global error handling
document.addEventListener('DOMContentLoaded', () => {
    window.errorHandler.setupGlobalErrorHandler();
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorComponent;
}

