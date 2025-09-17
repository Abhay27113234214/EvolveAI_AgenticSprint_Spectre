// AI CFO Assistant - Utility Functions

/**
 * Format currency values with proper locale and currency symbol
 * @param {number} amount - The amount to format
 * @param {string} currency - Currency code (default: USD)
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount, currency = 'USD') {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return '$0.00';
    }
    
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

/**
 * Format numbers with thousand separators
 * @param {number} value - The number to format
 * @param {number} decimals - Number of decimal places (default: 0)
 * @returns {string} Formatted number string
 */
function formatNumber(value, decimals = 0) {
    if (typeof value !== 'number' || isNaN(value)) {
        return '0';
    }
    
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
}

/**
 * Format percentage values
 * @param {number} value - The decimal value to format as percentage
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted percentage string
 */
function formatPercentage(value, decimals = 1) {
    if (typeof value !== 'number' || isNaN(value)) {
        return '0.0%';
    }
    
    return new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
}

/**
 * Format date strings to human-readable format
 * @param {string|Date} date - Date to format
 * @param {string} format - Format type: 'short', 'medium', 'long' (default: 'medium')
 * @returns {string} Formatted date string
 */
function formatDate(date, format = 'medium') {
    if (!date) return 'N/A';
    
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return 'Invalid Date';
    
    const options = {
        short: { year: 'numeric', month: 'short', day: 'numeric' },
        medium: { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
        long: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    };
    
    return dateObj.toLocaleDateString('en-US', options[format] || options.medium);
}

/**
 * Get relative time string (e.g., "2 minutes ago")
 * @param {string|Date} date - Date to compare
 * @returns {string} Relative time string
 */
function getRelativeTime(date) {
    if (!date) return 'Unknown';
    
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return 'Unknown';
    
    const now = new Date();
    const diffMs = now - dateObj;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    
    return formatDate(dateObj, 'short');
}

/**
 * Debounce function to limit function call frequency
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Show loading state on an element
 * @param {HTMLElement} element - Element to show loading on
 * @param {string} text - Loading text (optional)
 */
function showLoading(element, text = 'Loading...') {
    if (!element) return;
    
    element.classList.add('loading');
    const originalContent = element.innerHTML;
    element.dataset.originalContent = originalContent;
    
    element.innerHTML = `
        <div class="spinner"></div>
        ${text ? `<span class="ml-sm">${text}</span>` : ''}
    `;
}

/**
 * Hide loading state and restore original content
 * @param {HTMLElement} element - Element to hide loading from
 */
function hideLoading(element) {
    if (!element) return;
    
    element.classList.remove('loading');
    const originalContent = element.dataset.originalContent;
    
    if (originalContent) {
        element.innerHTML = originalContent;
        delete element.dataset.originalContent;
    }
}

/**
 * Show notification toast
 * @param {string} message - Message to display
 * @param {string} type - Notification type: 'success', 'warning', 'danger', 'info'
 * @param {number} duration - Duration in milliseconds (default: 5000)
 */
function showNotification(message, type = 'info', duration = 5000) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: var(--space-lg);
        right: var(--space-lg);
        z-index: 9999;
        max-width: 400px;
        box-shadow: var(--shadow-lg);
        opacity: 0;
        transform: translateX(100%);
        transition: var(--transition-normal);
    `;
    notification.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: none; border: none; color: inherit; cursor: pointer; padding: 0; margin-left: var(--space-md);"
                    aria-label="Close notification">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Auto remove
    if (duration > 0) {
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
}

/**
 * Validate form data
 * @param {Object} data - Data to validate
 * @param {Object} rules - Validation rules
 * @returns {Object} Validation result with success status and errors
 */
function validateForm(data, rules) {
    const errors = {};
    let isValid = true;
    
    for (const [field, fieldRules] of Object.entries(rules)) {
        const value = data[field];
        
        // Required validation
        if (fieldRules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
            errors[field] = fieldRules.message || `${field} is required`;
            isValid = false;
            continue;
        }
        
        // Skip other validations if field is empty and not required
        if (!value && !fieldRules.required) continue;
        
        // Email validation
        if (fieldRules.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors[field] = fieldRules.message || 'Invalid email format';
            isValid = false;
        }
        
        // Min length validation
        if (fieldRules.minLength && value.length < fieldRules.minLength) {
            errors[field] = fieldRules.message || `Minimum ${fieldRules.minLength} characters required`;
            isValid = false;
        }
        
        // Max length validation
        if (fieldRules.maxLength && value.length > fieldRules.maxLength) {
            errors[field] = fieldRules.message || `Maximum ${fieldRules.maxLength} characters allowed`;
            isValid = false;
        }
        
        // Pattern validation
        if (fieldRules.pattern && !fieldRules.pattern.test(value)) {
            errors[field] = fieldRules.message || 'Invalid format';
            isValid = false;
        }
    }
    
    return { isValid, errors };
}

/**
 * Safely get nested object property
 * @param {Object} obj - Object to traverse
 * @param {string} path - Dot-notation path to property
 * @param {*} defaultValue - Default value if property doesn't exist
 * @returns {*} Property value or default value
 */
function getNestedProperty(obj, path, defaultValue = undefined) {
    if (!obj || !path) return defaultValue;
    
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : defaultValue;
    }, obj);
}

/**
 * Generate unique ID
 * @returns {string} Unique ID string
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Download data as file
 * @param {string} data - Data to download
 * @param {string} filename - Filename for download
 * @param {string} type - MIME type (default: 'text/plain')
 */
function downloadFile(data, filename, type = 'text/plain') {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
}

/**
 * Check if user prefers reduced motion
 * @returns {boolean} True if user prefers reduced motion
 */
function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Smooth scroll to element
 * @param {HTMLElement|string} element - Element or selector to scroll to
 * @param {Object} options - Scroll options
 */
function scrollToElement(element, options = {}) {
    const target = typeof element === 'string' ? document.querySelector(element) : element;
    if (!target) return;
    
    const defaultOptions = {
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
        inline: 'nearest'
    };
    
    target.scrollIntoView({ ...defaultOptions, ...options });
}

/**
 * Set active navigation item based on current page
 */
function setActiveNavigation() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.navbar-nav a');
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
        
        const linkPage = link.getAttribute('href');
        if (linkPage === currentPage || (currentPage === '' && linkPage === 'index.html')) {
            link.classList.add('active');
            link.setAttribute('aria-current', 'page');
        }
    });
}

/**
 * Initialize common functionality on page load
 */
function initializePage() {
    // Set active navigation
    setActiveNavigation();
    
    // Add keyboard navigation support for clickable cards
    document.querySelectorAll('[role="button"][tabindex="0"]').forEach(element => {
        element.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
        });
    });
}

// Initialize page when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}

// Export functions for use in other modules
window.Utils = {
    formatCurrency,
    formatNumber,
    formatPercentage,
    formatDate,
    getRelativeTime,
    debounce,
    showLoading,
    hideLoading,
    showNotification,
    validateForm,
    getNestedProperty,
    generateId,
    downloadFile,
    prefersReducedMotion,
    scrollToElement,
    setActiveNavigation
};