// Simple authentication handling for Spectre
// Clean, straightforward code that works

document.addEventListener('DOMContentLoaded', function() {
    
    // Handle login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        setupLoginForm(loginForm);
    }
    
    // Handle signup form
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        setupSignupForm(signupForm);
    }
});

function setupLoginForm(form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const emailField = form.querySelector('#email');
    const passwordField = form.querySelector('#password');
    
    form.addEventListener('submit', async function(e) {
        // Clear any previous errors
        clearErrors(form);
        
        // Basic validation
        const email = emailField.value.trim();
        const password = passwordField.value;
        
        if (!email) {
            showError('emailError', 'Please enter your email');
            e.preventDefault();
            return;
        }
        
        if (!password) {
            showError('passwordError', 'Please enter your password');
            e.preventDefault();
            return;
        }
        
        if (!isValidEmail(email)) {
            showError('emailError', 'Please enter a valid email address');
            e.preventDefault();
            return;
        }
        
        // Show loading state
        setButtonLoading(submitBtn, true);
        
        // Form will submit naturally to Flask backend
        // Flask will handle the redirect or return errors
    });
}

function setupSignupForm(form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const nameField = form.querySelector('#name');
    const emailField = form.querySelector('#email');
    const passwordField = form.querySelector('#password');
    const roleField = form.querySelector('#role');
    
    // Real-time password strength feedback
    passwordField.addEventListener('input', function() {
        const strength = checkPasswordStrength(this.value);
        updatePasswordHint(strength);
    });
    
    form.addEventListener('submit', async function(e) {
        // Clear any previous errors
        clearErrors(form);
        
        // Get form values
        const name = nameField.value.trim();
        const email = emailField.value.trim();
        const password = passwordField.value;
        const role = roleField.value;
        
        let hasErrors = false;
        
        // Validate fields
        if (!name || name.length < 2) {
            showError('nameError', 'Please enter your full name');
            hasErrors = true;
        }
        
        if (!email) {
            showError('emailError', 'Please enter your email');
            hasErrors = true;
        } else if (!isValidEmail(email)) {
            showError('emailError', 'Please enter a valid email address');
            hasErrors = true;
        }
        
        if (!password) {
            showError('passwordError', 'Please create a password');
            hasErrors = true;
        } else if (password.length < 8) {
            showError('passwordError', 'Password must be at least 8 characters');
            hasErrors = true;
        }
        
        if (!role) {
            showError('roleError', 'Please select your role');
            hasErrors = true;
        }
        
        if (hasErrors) {
            e.preventDefault();
            return;
        }
        
        // Show loading state
        setButtonLoading(submitBtn, true);
        
        // Form will submit to Flask backend
    });
}

// Helper functions - clean and simple

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function checkPasswordStrength(password) {
    if (password.length < 8) return 'weak';
    
    const hasNumbers = /\d/.test(password);
    const hasSymbols = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasUpperCase = /[A-Z]/.test(password);
    
    if (hasNumbers && hasSymbols && hasLowerCase && hasUpperCase) {
        return 'strong';
    } else if ((hasNumbers && hasSymbols) || password.length >= 12) {
        return 'medium';
    } else {
        return 'weak';
    }
}

function updatePasswordHint(strength) {
    const hint = document.querySelector('.form-hint');
    if (!hint) return;
    
    const messages = {
        weak: 'Add numbers, symbols, and make it longer',
        medium: 'Good! Consider adding more complexity',
        strong: 'Great password! ✓'
    };
    
    const colors = {
        weak: 'var(--danger-color)',
        medium: 'var(--warning-color)',
        strong: 'var(--success-color)'
    };
    
    hint.textContent = messages[strength] || messages.weak;
    hint.style.color = colors[strength] || colors.weak;
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

function clearErrors(form) {
    const errorElements = form.querySelectorAll('.error-message');
    errorElements.forEach(element => {
        element.textContent = '';
        element.style.display = 'none';
    });
}

function setButtonLoading(button, loading) {
    if (loading) {
        button.disabled = true;
        button.classList.add('loading');
        
        // Store original text
        button.dataset.originalText = button.textContent;
        button.innerHTML = `
            <div class="spinner" style="width: 16px; height: 16px; margin-right: 8px;"></div>
            Loading...
        `;
    } else {
        button.disabled = false;
        button.classList.remove('loading');
        button.textContent = button.dataset.originalText || 'Submit';
    }
}

// Handle Flask flash messages if they exist
function handleFlashMessages() {
    const flashMessages = document.querySelectorAll('.flash-message');
    flashMessages.forEach(message => {
        // Auto-hide success messages after 5 seconds
        if (message.classList.contains('flash-success')) {
            setTimeout(() => {
                message.style.opacity = '0';
                setTimeout(() => message.remove(), 300);
            }, 5000);
        }
    });
}

// Call on page load
handleFlashMessages();