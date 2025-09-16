// AI CFO Assistant - API Module

/**
 * API Configuration
 */
const API_CONFIG = {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:5000',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000
};

/**
 * Base API class with error handling and retry logic
 */
class ApiClient {
    constructor(config = API_CONFIG) {
        this.config = config;
        this.isOnline = navigator.onLine;
        
        // Listen for online/offline events
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('Connection restored');
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('Connection lost - switching to fallback mode');
        });
    }

    /**
     * Make HTTP request with retry logic
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Fetch options
     * @returns {Promise} Response data or fallback data
     */
    async request(endpoint, options = {}) {
        const url = `${this.config.baseUrl}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            timeout: this.config.timeout,
            ...options
        };

        // If offline, immediately return fallback data
        if (!this.isOnline) {
            console.warn('Offline - using fallback data for:', endpoint);
            return await this.getFallbackData(endpoint);
        }

        let lastError;
        
        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
                console.log(`API request attempt ${attempt}: ${endpoint}`);
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
                
                const response = await fetch(url, {
                    ...defaultOptions,
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log('API request successful:', endpoint);
                return data;
                
            } catch (error) {
                lastError = error;
                console.warn(`API request failed (attempt ${attempt}):`, error.message);
                
                // Don't retry on certain errors
                if (error.name === 'AbortError' || error.message.includes('404')) {
                    break;
                }
                
                // Wait before retry
                if (attempt < this.config.retryAttempts) {
                    await this.delay(this.config.retryDelay * attempt);
                }
            }
        }
        
        console.error(`All API attempts failed for ${endpoint}, using fallback data:`, lastError.message);
        return await this.getFallbackData(endpoint);
    }

    /**
     * GET request
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Query parameters
     * @returns {Promise} Response data
     */
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return await this.request(url);
    }

    /**
     * POST request
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request body data
     * @returns {Promise} Response data
     */
    async post(endpoint, data = {}) {
        return await this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT request
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request body data
     * @returns {Promise} Response data
     */
    async put(endpoint, data = {}) {
        return await this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE request
     * @param {string} endpoint - API endpoint
     * @returns {Promise} Response data
     */
    async delete(endpoint) {
        return await this.request(endpoint, {
            method: 'DELETE'
        });
    }

    /**
     * Upload files
     * @param {string} endpoint - API endpoint
     * @param {FormData} formData - Form data with files
     * @param {Function} onProgress - Progress callback
     * @returns {Promise} Response data
     */
    async upload(endpoint, formData, onProgress = null) {
        const url = `${this.config.baseUrl}${endpoint}`;
        
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && onProgress) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    onProgress(percentComplete);
                }
            });
            
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (error) {
                        resolve({ success: true, message: 'Upload completed' });
                    }
                } else {
                    reject(new Error(`Upload failed: HTTP ${xhr.status}`));
                }
            });
            
            xhr.addEventListener('error', () => {
                reject(new Error('Upload failed due to network error'));
            });
            
            xhr.addEventListener('abort', () => {
                reject(new Error('Upload was aborted'));
            });
            
            xhr.open('POST', url);
            xhr.send(formData);
        });
    }

    /**
     * Get fallback data when API is unavailable
     * @param {string} endpoint - API endpoint
     * @returns {Promise} Fallback data
     */
    async getFallbackData(endpoint) {
        // Map API endpoints to mock data
        const fallbackMap = {
            '/api/financials': '/mock/financials.json',
            '/api/risks': '/mock/financials.json', // Use same mock data
            '/api/ask': null, // No fallback for chat
            '/upload': { success: false, message: 'Upload unavailable offline' }
        };
        
        const fallbackPath = fallbackMap[endpoint];
        
        if (!fallbackPath) {
            throw new Error('No fallback data available for this endpoint');
        }
        
        if (typeof fallbackPath === 'object') {
            return fallbackPath;
        }
        
        try {
            const response = await fetch(fallbackPath);
            if (!response.ok) {
                throw new Error('Fallback data not available');
            }
            return await response.json();
        } catch (error) {
            console.error('Failed to load fallback data:', error);
            return this.getDefaultData(endpoint);
        }
    }

    /**
     * Get default data structure when all else fails
     * @param {string} endpoint - API endpoint
     * @returns {Object} Default data
     */
    getDefaultData(endpoint) {
        const defaults = {
            '/api/financials': {
                success: false,
                message: 'Financial data unavailable',
                data: {
                    revenue: 0,
                    expenses: 0,
                    burn_rate: 0,
                    cash_runway: 0,
                    liabilities: 0
                }
            },
            '/api/risks': {
                success: false,
                message: 'Risk data unavailable',
                risks: []
            }
        };
        
        return defaults[endpoint] || { success: false, message: 'Data unavailable' };
    }

    /**
     * Delay utility for retry logic
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Promise that resolves after delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Financial API methods
 */
class FinancialApi extends ApiClient {
    /**
     * Get financial data
     * @returns {Promise} Financial data
     */
    async getFinancials() {
        return await this.get('/api/financials');
    }

    /**
     * Get risk assessment
     * @returns {Promise} Risk data
     */
    async getRisks() {
        return await this.get('/api/risks');
    }

    /**
     * Ask AI CFO a question
     * @param {string} question - Question to ask
     * @returns {Promise} AI response
     */
    async askQuestion(question) {
        return await this.post('/api/ask', { question });
    }

    /**
     * Upload financial documents
     * @param {FileList} files - Files to upload
     * @param {Function} onProgress - Progress callback
     * @returns {Promise} Upload response
     */
    async uploadDocuments(files, onProgress = null) {
        const formData = new FormData();
        
        Array.from(files).forEach((file, index) => {
            formData.append(`file${index}`, file);
        });
        
        return await this.upload('/upload', formData, onProgress);
    }

    /**
     * Get monitoring data
     * @param {Object} filters - Monitoring filters
     * @returns {Promise} Monitoring data
     */
    async getMonitoringData(filters = {}) {
        return await this.get('/api/monitoring', filters);
    }

    /**
     * Get anomalies
     * @param {Object} filters - Anomaly filters
     * @returns {Promise} Anomaly data
     */
    async getAnomalies(filters = {}) {
        return await this.get('/api/anomalies', filters);
    }

    /**
     * Get forecasts
     * @param {string} scenario - Forecast scenario (optimistic, realistic, pessimistic)
     * @param {number} months - Number of months to forecast
     * @returns {Promise} Forecast data
     */
    async getForecast(scenario = 'realistic', months = 6) {
        return await this.get('/api/forecast', { scenario, months });
    }

    /**
     * Export financial data
     * @param {string} format - Export format (csv, xlsx, pdf)
     * @returns {Promise} Export data
     */
    async exportData(format = 'csv') {
        return await this.get('/api/export', { format });
    }
}

/**
 * Create API instance
 */
const api = new FinancialApi();

/**
 * Global API functions for easy access
 */
window.API = {
    // Financial data
    getFinancials: () => api.getFinancials(),
    getRisks: () => api.getRisks(),
    getMonitoringData: (filters) => api.getMonitoringData(filters),
    getAnomalies: (filters) => api.getAnomalies(filters),
    getForecast: (scenario, months) => api.getForecast(scenario, months),
    
    // AI interactions
    askQuestion: (question) => api.askQuestion(question),
    
    // File operations
    uploadDocuments: (files, onProgress) => api.uploadDocuments(files, onProgress),
    exportData: (format) => api.exportData(format),
    
    // Utility
    isOnline: () => api.isOnline,
    getConfig: () => api.config
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FinancialApi, API: window.API };
}