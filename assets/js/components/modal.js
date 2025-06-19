// Modal Component
// Handles modal dialogs and popups throughout the application

class ModalComponent {
    constructor() {
        this.activeModals = new Map();
        this.modalStack = [];
        this.defaultOptions = {
            backdrop: true,
            keyboard: true,
            focus: true,
            size: 'medium',
            animation: 'fade',
            closeButton: true
        };
        
        this.createModalStyles();
        this.setupEventListeners();
    }

    createModalStyles() {
        if (document.getElementById('modal-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'modal-styles';
        styles.textContent = `
            .modal-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
                z-index: 1040;
                opacity: 0;
                transition: opacity 0.3s ease;
            }

            .modal-backdrop.show {
                opacity: 1;
            }

            .modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 1050;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 1rem;
                opacity: 0;
                transform: scale(0.9);
                transition: all 0.3s ease;
            }

            .modal.show {
                opacity: 1;
                transform: scale(1);
            }

            .modal.fade-in {
                animation: modalFadeIn 0.3s ease;
            }

            .modal.slide-down {
                transform: translateY(-100%);
                transition: transform 0.3s ease;
            }

            .modal.slide-down.show {
                transform: translateY(0);
            }

            .modal-dialog {
                background: rgba(15, 23, 42, 0.98);
                border: 1px solid rgba(139, 92, 246, 0.3);
                border-radius: 12px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                max-height: 90vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                width: 100%;
                max-width: 500px;
            }

            .modal-dialog.small {
                max-width: 300px;
            }

            .modal-dialog.medium {
                max-width: 500px;
            }

            .modal-dialog.large {
                max-width: 800px;
            }

            .modal-dialog.extra-large {
                max-width: 1200px;
            }

            .modal-header {
                padding: 1.5rem;
                border-bottom: 1px solid rgba(156, 163, 175, 0.2);
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-shrink: 0;
            }

            .modal-title {
                color: #e4e8f1;
                font-size: 1.25rem;
                font-weight: 600;
                margin: 0;
            }

            .modal-close {
                background: none;
                border: none;
                color: #9ca3af;
                cursor: pointer;
                padding: 0.5rem;
                width: 2rem;
                height: 2rem;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 6px;
                transition: all 0.2s ease;
                font-size: 1.5rem;
                line-height: 1;
            }

            .modal-close:hover {
                background: rgba(156, 163, 175, 0.1);
                color: #e4e8f1;
            }

            .modal-body {
                padding: 1.5rem;
                color: #d1d5db;
                overflow-y: auto;
                flex: 1;
            }

            .modal-footer {
                padding: 1.5rem;
                border-top: 1px solid rgba(156, 163, 175, 0.2);
                display: flex;
                gap: 0.75rem;
                justify-content: flex-end;
                flex-shrink: 0;
            }

            .modal-button {
                padding: 0.5rem 1rem;
                border-radius: 6px;
                font-size: 0.875rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                border: 1px solid transparent;
            }

            .modal-button.primary {
                background: linear-gradient(135deg, #8b5cf6, #a855f7);
                color: white;
                border-color: #8b5cf6;
            }

            .modal-button.primary:hover {
                background: linear-gradient(135deg, #7c3aed, #9333ea);
                transform: translateY(-1px);
            }

            .modal-button.secondary {
                background: rgba(139, 92, 246, 0.1);
                color: #a855f7;
                border-color: rgba(139, 92, 246, 0.3);
            }

            .modal-button.secondary:hover {
                background: rgba(139, 92, 246, 0.2);
                border-color: rgba(139, 92, 246, 0.5);
            }

            .modal-button.danger {
                background: rgba(239, 68, 68, 0.1);
                color: #ef4444;
                border-color: rgba(239, 68, 68, 0.3);
            }

            .modal-button.danger:hover {
                background: rgba(239, 68, 68, 0.2);
                border-color: rgba(239, 68, 68, 0.5);
            }

            @keyframes modalFadeIn {
                from {
                    opacity: 0;
                    transform: scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }

            @media (max-width: 640px) {
                .modal {
                    padding: 0.5rem;
                }

                .modal-dialog {
                    max-width: none;
                    width: 100%;
                    max-height: 95vh;
                }

                .modal-header,
                .modal-body,
                .modal-footer {
                    padding: 1rem;
                }

                .modal-footer {
                    flex-direction: column;
                }

                .modal-button {
                    width: 100%;
                    justify-content: center;
                }
            }
        `;
        
        document.head.appendChild(styles);
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modalStack.length > 0) {
                const topModal = this.modalStack[this.modalStack.length - 1];
                const modalInfo = this.activeModals.get(topModal);
                if (modalInfo && modalInfo.config.keyboard) {
                    this.hide(topModal);
                }
            }
        });
    }

    show(options = {}) {
        const config = { ...this.defaultOptions, ...options };
        const modalId = this.generateId();
        
        // Create backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.id = `modal-backdrop-${modalId}`;
        
        if (config.backdrop) {
            backdrop.addEventListener('click', () => {
                this.hide(modalId);
            });
        }
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = `modal ${config.animation}`;
        modal.id = `modal-${modalId}`;
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        
        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = `modal-dialog ${config.size}`;
        
        // Create header
        if (config.title || config.closeButton) {
            const header = document.createElement('div');
            header.className = 'modal-header';
            
            if (config.title) {
                const title = document.createElement('h3');
                title.className = 'modal-title';
                title.textContent = config.title;
                header.appendChild(title);
            }
            
            if (config.closeButton) {
                const closeButton = document.createElement('button');
                closeButton.className = 'modal-close';
                closeButton.innerHTML = '×';
                closeButton.setAttribute('aria-label', 'Close');
                closeButton.onclick = () => this.hide(modalId);
                header.appendChild(closeButton);
            }
            
            dialog.appendChild(header);
        }
        
        // Create body
        const body = document.createElement('div');
        body.className = 'modal-body';
        
        if (config.content) {
            if (typeof config.content === 'string') {
                body.innerHTML = config.content;
            } else {
                body.appendChild(config.content);
            }
        }
        
        dialog.appendChild(body);
        
        // Create footer
        if (config.buttons && config.buttons.length > 0) {
            const footer = document.createElement('div');
            footer.className = 'modal-footer';
            
            config.buttons.forEach(button => {
                const btn = document.createElement('button');
                btn.className = `modal-button ${button.type || 'secondary'}`;
                btn.textContent = button.text;
                btn.onclick = () => {
                    if (button.handler) {
                        button.handler();
                    }
                    if (button.dismiss !== false) {
                        this.hide(modalId);
                    }
                };
                footer.appendChild(btn);
            });
            
            dialog.appendChild(footer);
        }
        
        modal.appendChild(dialog);
        
        // Add to DOM
        document.body.appendChild(backdrop);
        document.body.appendChild(modal);
        
        // Store modal info
        this.activeModals.set(modalId, {
            modal,
            backdrop,
            dialog,
            body,
            config
        });
        
        this.modalStack.push(modalId);
        
        // Show modal
        requestAnimationFrame(() => {
            backdrop.classList.add('show');
            modal.classList.add('show');
            
            if (config.focus) {
                const focusElement = modal.querySelector('input, button, textarea, select');
                if (focusElement) {
                    focusElement.focus();
                }
            }
        });
        
        return modalId;
    }

    hide(modalId) {
        const modalInfo = this.activeModals.get(modalId);
        if (!modalInfo) return;
        
        const { modal, backdrop } = modalInfo;
        
        modal.classList.remove('show');
        backdrop.classList.remove('show');
        
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
            if (backdrop.parentNode) {
                backdrop.parentNode.removeChild(backdrop);
            }
        }, 300);
        
        this.activeModals.delete(modalId);
        this.modalStack = this.modalStack.filter(id => id !== modalId);
    }

    hideAll() {
        this.activeModals.forEach((_, modalId) => {
            this.hide(modalId);
        });
    }

    updateContent(modalId, content) {
        const modalInfo = this.activeModals.get(modalId);
        if (modalInfo) {
            const { body } = modalInfo;
            if (typeof content === 'string') {
                body.innerHTML = content;
            } else {
                body.innerHTML = '';
                body.appendChild(content);
            }
        }
    }

    // Convenience methods
    alert(message, title = 'Alert') {
        return this.show({
            title,
            content: message,
            buttons: [
                { text: 'OK', type: 'primary' }
            ]
        });
    }

    confirm(message, title = 'Confirm') {
        return new Promise((resolve) => {
            this.show({
                title,
                content: message,
                buttons: [
                    { 
                        text: 'Cancel', 
                        type: 'secondary',
                        handler: () => resolve(false)
                    },
                    { 
                        text: 'OK', 
                        type: 'primary',
                        handler: () => resolve(true)
                    }
                ]
            });
        });
    }

    prompt(message, defaultValue = '', title = 'Input') {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = defaultValue;
            input.className = 'form-input';
            input.style.cssText = `
                width: 100%;
                padding: 0.5rem;
                border: 1px solid rgba(139, 92, 246, 0.3);
                border-radius: 6px;
                background: rgba(15, 23, 42, 0.5);
                color: #e4e8f1;
                margin-top: 1rem;
            `;
            
            const container = document.createElement('div');
            container.innerHTML = message;
            container.appendChild(input);
            
            this.show({
                title,
                content: container,
                buttons: [
                    { 
                        text: 'Cancel', 
                        type: 'secondary',
                        handler: () => resolve(null)
                    },
                    { 
                        text: 'OK', 
                        type: 'primary',
                        handler: () => resolve(input.value)
                    }
                ],
                focus: true
            });
            
            setTimeout(() => input.focus(), 100);
        });
    }

    loading(message = 'Loading...', title = 'Please Wait') {
        const spinner = document.createElement('div');
        spinner.style.cssText = `
            display: flex;
            align-items: center;
            gap: 1rem;
            justify-content: center;
            padding: 2rem 0;
        `;
        
        const spinnerIcon = document.createElement('div');
        spinnerIcon.style.cssText = `
            width: 24px;
            height: 24px;
            border: 2px solid rgba(139, 92, 246, 0.3);
            border-top: 2px solid #8b5cf6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        `;
        
        const text = document.createElement('span');
        text.textContent = message;
        text.style.color = '#d1d5db';
        
        spinner.appendChild(spinnerIcon);
        spinner.appendChild(text);
        
        return this.show({
            title,
            content: spinner,
            closeButton: false,
            backdrop: false,
            keyboard: false
        });
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// Create global modal instance
window.modal = new ModalComponent();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalComponent;
}

