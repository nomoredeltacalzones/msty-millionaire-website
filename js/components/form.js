// Form Component
// Handles form validation, submission, and user interactions

class FormComponent {
    constructor() {
        this.forms = new Map();
        this.validators = new Map();
        this.defaultOptions = {
            validateOnInput: true,
            validateOnBlur: true,
            showErrors: true,
            submitButton: null,
            resetOnSubmit: false,
            confirmBeforeReset: true
        };
        
        this.createFormStyles();
        this.setupGlobalValidators();
    }

    createFormStyles() {
        if (document.getElementById('form-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'form-styles';
        styles.textContent = `
            .form-group {
                margin-bottom: 1.5rem;
            }

            .form-label {
                display: block;
                color: #e4e8f1;
                font-size: 0.875rem;
                font-weight: 500;
                margin-bottom: 0.5rem;
            }

            .form-label.required::after {
                content: ' *';
                color: #ef4444;
            }

            .form-input,
            .form-select,
            .form-textarea {
                width: 100%;
                padding: 0.75rem;
                border: 1px solid rgba(139, 92, 246, 0.3);
                border-radius: 6px;
                background: rgba(15, 23, 42, 0.5);
                color: #e4e8f1;
                font-size: 0.875rem;
                transition: all 0.2s ease;
            }

            .form-input:focus,
            .form-select:focus,
            .form-textarea:focus {
                outline: none;
                border-color: #8b5cf6;
                box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
            }

            .form-input.error,
            .form-select.error,
            .form-textarea.error {
                border-color: #ef4444;
                box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
            }

            .form-input.success,
            .form-select.success,
            .form-textarea.success {
                border-color: #10b981;
                box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
            }

            .form-error {
                color: #ef4444;
                font-size: 0.75rem;
                margin-top: 0.25rem;
                display: flex;
                align-items: center;
                gap: 0.25rem;
            }

            .form-success {
                color: #10b981;
                font-size: 0.75rem;
                margin-top: 0.25rem;
                display: flex;
                align-items: center;
                gap: 0.25rem;
            }

            .form-help {
                color: #9ca3af;
                font-size: 0.75rem;
                margin-top: 0.25rem;
            }

            .form-checkbox,
            .form-radio {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                margin-bottom: 0.5rem;
            }

            .form-checkbox input,
            .form-radio input {
                width: auto;
                margin: 0;
            }

            .form-checkbox label,
            .form-radio label {
                margin: 0;
                font-weight: normal;
                cursor: pointer;
            }

            .form-submit {
                background: linear-gradient(135deg, #8b5cf6, #a855f7);
                color: white;
                border: none;
                padding: 0.75rem 2rem;
                border-radius: 6px;
                font-size: 0.875rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                position: relative;
                overflow: hidden;
            }

            .form-submit:hover:not(:disabled) {
                background: linear-gradient(135deg, #7c3aed, #9333ea);
                transform: translateY(-1px);
            }

            .form-submit:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
            }

            .form-submit.loading {
                color: transparent;
            }

            .form-submit.loading::after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 16px;
                height: 16px;
                margin: -8px 0 0 -8px;
                border: 2px solid transparent;
                border-top: 2px solid white;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            .form-reset {
                background: rgba(139, 92, 246, 0.1);
                color: #a855f7;
                border: 1px solid rgba(139, 92, 246, 0.3);
                padding: 0.75rem 2rem;
                border-radius: 6px;
                font-size: 0.875rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                margin-left: 0.75rem;
            }

            .form-reset:hover {
                background: rgba(139, 92, 246, 0.2);
                border-color: rgba(139, 92, 246, 0.5);
            }

            .form-progress {
                width: 100%;
                height: 4px;
                background: rgba(139, 92, 246, 0.3);
                border-radius: 2px;
                margin-bottom: 1rem;
                overflow: hidden;
            }

            .form-progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #8b5cf6, #a855f7);
                border-radius: 2px;
                transition: width 0.3s ease;
                width: 0%;
            }

            .form-step {
                display: none;
            }

            .form-step.active {
                display: block;
            }

            .form-steps {
                display: flex;
                justify-content: space-between;
                margin-bottom: 2rem;
                padding: 0;
                list-style: none;
            }

            .form-steps li {
                flex: 1;
                text-align: center;
                position: relative;
                color: #6b7280;
                font-size: 0.875rem;
            }

            .form-steps li.completed {
                color: #10b981;
            }

            .form-steps li.active {
                color: #8b5cf6;
                font-weight: 500;
            }

            .form-steps li::before {
                content: '';
                position: absolute;
                top: -1rem;
                left: 50%;
                transform: translateX(-50%);
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #6b7280;
            }

            .form-steps li.completed::before {
                background: #10b981;
            }

            .form-steps li.active::before {
                background: #8b5cf6;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            @media (max-width: 640px) {
                .form-submit,
                .form-reset {
                    width: 100%;
                    margin: 0.5rem 0 0 0;
                }
            }
        `;
        
        document.head.appendChild(styles);
    }

    setupGlobalValidators() {
        // Email validator
        this.addValidator('email', (value) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(value) || 'Please enter a valid email address';
        });

        // Required validator
        this.addValidator('required', (value) => {
            return (value && value.trim().length > 0) || 'This field is required';
        });

        // Min length validator
        this.addValidator('minLength', (value, min) => {
            return (value && value.length >= min) || `Minimum ${min} characters required`;
        });

        // Max length validator
        this.addValidator('maxLength', (value, max) => {
            return (value && value.length <= max) || `Maximum ${max} characters allowed`;
        });

        // Number validator
        this.addValidator('number', (value) => {
            return (!isNaN(value) && !isNaN(parseFloat(value))) || 'Please enter a valid number';
        });

        // URL validator
        this.addValidator('url', (value) => {
            try {
                new URL(value);
                return true;
            } catch {
                return 'Please enter a valid URL';
            }
        });

        // Phone validator
        this.addValidator('phone', (value) => {
            const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
            return phoneRegex.test(value.replace(/\s/g, '')) || 'Please enter a valid phone number';
        });

        // Password strength validator
        this.addValidator('password', (value) => {
            if (value.length < 8) return 'Password must be at least 8 characters';
            if (!/[A-Z]/.test(value)) return 'Password must contain at least one uppercase letter';
            if (!/[a-z]/.test(value)) return 'Password must contain at least one lowercase letter';
            if (!/\d/.test(value)) return 'Password must contain at least one number';
            return true;
        });
    }

    // Initialize form
    init(formElement, options = {}) {
        if (typeof formElement === 'string') {
            formElement = document.querySelector(formElement);
        }

        if (!formElement) return null;

        const config = { ...this.defaultOptions, ...options };
        const formId = this.generateId();

        // Store form configuration
        this.forms.set(formId, {
            element: formElement,
            config,
            fields: new Map(),
            currentStep: 0,
            totalSteps: formElement.querySelectorAll('.form-step').length || 1
        });

        // Setup form
        this.setupForm(formId);
        
        return formId;
    }

    setupForm(formId) {
        const formInfo = this.forms.get(formId);
        if (!formInfo) return;

        const { element, config } = formInfo;

        // Setup form submission
        element.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit(formId);
        });

        // Setup field validation
        const fields = element.querySelectorAll('input, select, textarea');
        fields.forEach(field => {
            this.setupField(formId, field);
        });

        // Setup multi-step if applicable
        if (formInfo.totalSteps > 1) {
            this.setupMultiStep(formId);
        }

        // Setup submit button
        const submitButton = element.querySelector('.form-submit');
        if (submitButton) {
            formInfo.config.submitButton = submitButton;
        }
    }

    setupField(formId, field) {
        const formInfo = this.forms.get(formId);
        if (!formInfo) return;

        const fieldName = field.name || field.id;
        if (!fieldName) return;

        // Store field info
        formInfo.fields.set(fieldName, {
            element: field,
            validators: this.getFieldValidators(field),
            isValid: true,
            value: field.value
        });

        // Setup validation events
        if (formInfo.config.validateOnInput) {
            field.addEventListener('input', () => {
                this.validateField(formId, fieldName);
            });
        }

        if (formInfo.config.validateOnBlur) {
            field.addEventListener('blur', () => {
                this.validateField(formId, fieldName);
            });
        }
    }

    getFieldValidators(field) {
        const validators = [];
        
        // Required
        if (field.required || field.hasAttribute('data-required')) {
            validators.push({ name: 'required' });
        }

        // Email
        if (field.type === 'email' || field.hasAttribute('data-email')) {
            validators.push({ name: 'email' });
        }

        // Number
        if (field.type === 'number' || field.hasAttribute('data-number')) {
            validators.push({ name: 'number' });
        }

        // URL
        if (field.type === 'url' || field.hasAttribute('data-url')) {
            validators.push({ name: 'url' });
        }

        // Phone
        if (field.type === 'tel' || field.hasAttribute('data-phone')) {
            validators.push({ name: 'phone' });
        }

        // Password
        if (field.type === 'password' || field.hasAttribute('data-password')) {
            validators.push({ name: 'password' });
        }

        // Min length
        if (field.minLength || field.hasAttribute('data-min-length')) {
            const min = field.minLength || parseInt(field.getAttribute('data-min-length'));
            validators.push({ name: 'minLength', params: [min] });
        }

        // Max length
        if (field.maxLength || field.hasAttribute('data-max-length')) {
            const max = field.maxLength || parseInt(field.getAttribute('data-max-length'));
            validators.push({ name: 'maxLength', params: [max] });
        }

        // Custom validators
        const customValidators = field.getAttribute('data-validators');
        if (customValidators) {
            customValidators.split(',').forEach(validatorName => {
                validators.push({ name: validatorName.trim() });
            });
        }

        return validators;
    }

    validateField(formId, fieldName) {
        const formInfo = this.forms.get(formId);
        if (!formInfo) return false;

        const fieldInfo = formInfo.fields.get(fieldName);
        if (!fieldInfo) return false;

        const { element, validators } = fieldInfo;
        const value = element.value;

        // Clear previous validation state
        this.clearFieldValidation(element);

        // Run validators
        for (const validator of validators) {
            const validatorFn = this.validators.get(validator.name);
            if (validatorFn) {
                const result = validatorFn(value, ...(validator.params || []));
                if (result !== true) {
                    this.showFieldError(element, result);
                    fieldInfo.isValid = false;
                    return false;
                }
            }
        }

        // Field is valid
        this.showFieldSuccess(element);
        fieldInfo.isValid = true;
        return true;
    }

    validateForm(formId) {
        const formInfo = this.forms.get(formId);
        if (!formInfo) return false;

        let isValid = true;

        // Validate all fields
        for (const [fieldName] of formInfo.fields) {
            if (!this.validateField(formId, fieldName)) {
                isValid = false;
            }
        }

        return isValid;
    }

    clearFieldValidation(field) {
        field.classList.remove('error', 'success');
        
        const errorElement = field.parentNode.querySelector('.form-error');
        if (errorElement) {
            errorElement.remove();
        }

        const successElement = field.parentNode.querySelector('.form-success');
        if (successElement) {
            successElement.remove();
        }
    }

    showFieldError(field, message) {
        field.classList.add('error');
        field.classList.remove('success');

        const errorElement = document.createElement('div');
        errorElement.className = 'form-error';
        errorElement.innerHTML = `⚠️ ${message}`;
        
        field.parentNode.appendChild(errorElement);
    }

    showFieldSuccess(field) {
        field.classList.add('success');
        field.classList.remove('error');

        const successElement = document.createElement('div');
        successElement.className = 'form-success';
        successElement.innerHTML = '✅ Valid';
        
        field.parentNode.appendChild(successElement);
    }

    async handleSubmit(formId) {
        const formInfo = this.forms.get(formId);
        if (!formInfo) return;

        const { element, config } = formInfo;

        // Validate form
        if (!this.validateForm(formId)) {
            if (window.errorHandler) {
                window.errorHandler.error('Please fix the errors in the form');
            }
            return;
        }

        // Show loading state
        if (config.submitButton) {
            config.submitButton.classList.add('loading');
            config.submitButton.disabled = true;
        }

        try {
            // Get form data
            const formData = new FormData(element);
            const data = Object.fromEntries(formData.entries());

            // Call submit handler if provided
            if (config.onSubmit) {
                await config.onSubmit(data, formId);
            }

            // Reset form if configured
            if (config.resetOnSubmit) {
                this.reset(formId);
            }

            // Show success message
            if (window.errorHandler) {
                window.errorHandler.success('Form submitted successfully!');
            }

        } catch (error) {
            console.error('Form submission error:', error);
            
            if (window.errorHandler) {
                window.errorHandler.handleApiError(error, 'Form Submission');
            }
        } finally {
            // Hide loading state
            if (config.submitButton) {
                config.submitButton.classList.remove('loading');
                config.submitButton.disabled = false;
            }
        }
    }

    // Multi-step form methods
    setupMultiStep(formId) {
        const formInfo = this.forms.get(formId);
        if (!formInfo) return;

        const { element } = formInfo;

        // Create progress bar
        this.createProgressBar(formId);

        // Create step navigation
        this.createStepNavigation(formId);

        // Show first step
        this.showStep(formId, 0);
    }

    createProgressBar(formId) {
        const formInfo = this.forms.get(formId);
        if (!formInfo) return;

        const { element, totalSteps } = formInfo;

        const progressContainer = document.createElement('div');
        progressContainer.className = 'form-progress';

        const progressBar = document.createElement('div');
        progressBar.className = 'form-progress-bar';
        progressBar.style.width = `${(1 / totalSteps) * 100}%`;

        progressContainer.appendChild(progressBar);
        element.insertBefore(progressContainer, element.firstChild);
    }

    createStepNavigation(formId) {
        const formInfo = this.forms.get(formId);
        if (!formInfo) return;

        const { element } = formInfo;
        const steps = element.querySelectorAll('.form-step');

        steps.forEach((step, index) => {
            if (index < steps.length - 1) {
                const nextButton = document.createElement('button');
                nextButton.type = 'button';
                nextButton.className = 'form-submit';
                nextButton.textContent = 'Next';
                nextButton.onclick = () => this.nextStep(formId);
                step.appendChild(nextButton);
            }

            if (index > 0) {
                const prevButton = document.createElement('button');
                prevButton.type = 'button';
                prevButton.className = 'form-reset';
                prevButton.textContent = 'Previous';
                prevButton.onclick = () => this.prevStep(formId);
                step.insertBefore(prevButton, step.firstChild);
            }
        });
    }

    showStep(formId, stepIndex) {
        const formInfo = this.forms.get(formId);
        if (!formInfo) return;

        const { element, totalSteps } = formInfo;
        const steps = element.querySelectorAll('.form-step');

        // Hide all steps
        steps.forEach(step => step.classList.remove('active'));

        // Show current step
        if (steps[stepIndex]) {
            steps[stepIndex].classList.add('active');
            formInfo.currentStep = stepIndex;
        }

        // Update progress bar
        const progressBar = element.querySelector('.form-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${((stepIndex + 1) / totalSteps) * 100}%`;
        }
    }

    nextStep(formId) {
        const formInfo = this.forms.get(formId);
        if (!formInfo) return;

        const { currentStep, totalSteps } = formInfo;

        // Validate current step
        if (!this.validateCurrentStep(formId)) {
            return;
        }

        if (currentStep < totalSteps - 1) {
            this.showStep(formId, currentStep + 1);
        }
    }

    prevStep(formId) {
        const formInfo = this.forms.get(formId);
        if (!formInfo) return;

        const { currentStep } = formInfo;

        if (currentStep > 0) {
            this.showStep(formId, currentStep - 1);
        }
    }

    validateCurrentStep(formId) {
        const formInfo = this.forms.get(formId);
        if (!formInfo) return false;

        const { element, currentStep } = formInfo;
        const currentStepElement = element.querySelectorAll('.form-step')[currentStep];
        
        if (!currentStepElement) return true;

        const fields = currentStepElement.querySelectorAll('input, select, textarea');
        let isValid = true;

        fields.forEach(field => {
            const fieldName = field.name || field.id;
            if (fieldName && !this.validateField(formId, fieldName)) {
                isValid = false;
            }
        });

        return isValid;
    }

    // Utility methods
    reset(formId) {
        const formInfo = this.forms.get(formId);
        if (!formInfo) return;

        const { element, config } = formInfo;

        if (config.confirmBeforeReset) {
            if (!confirm('Are you sure you want to reset the form?')) {
                return;
            }
        }

        element.reset();

        // Clear validation states
        formInfo.fields.forEach((fieldInfo, fieldName) => {
            this.clearFieldValidation(fieldInfo.element);
            fieldInfo.isValid = true;
        });

        // Reset to first step if multi-step
        if (formInfo.totalSteps > 1) {
            this.showStep(formId, 0);
        }
    }

    addValidator(name, validatorFn) {
        this.validators.set(name, validatorFn);
    }

    removeValidator(name) {
        this.validators.delete(name);
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// Create global form instance
window.formHandler = new FormComponent();

// Auto-initialize forms with data-form attribute
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('form[data-form]').forEach(form => {
        const options = {};
        
        // Parse options from data attributes
        if (form.hasAttribute('data-validate-on-input')) {
            options.validateOnInput = form.getAttribute('data-validate-on-input') === 'true';
        }
        
        if (form.hasAttribute('data-validate-on-blur')) {
            options.validateOnBlur = form.getAttribute('data-validate-on-blur') === 'true';
        }
        
        if (form.hasAttribute('data-reset-on-submit')) {
            options.resetOnSubmit = form.getAttribute('data-reset-on-submit') === 'true';
        }

        window.formHandler.init(form, options);
    });
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FormComponent;
}

