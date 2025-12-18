// Shared API Utility
const api = {
    // Get token from localStorage
    get token() {
        return localStorage.getItem('astr_token');
    },

    // Get user from localStorage
    get user() {
        const userStr = localStorage.getItem('astr_user');
        if (userStr) {
            try {
                return JSON.parse(userStr);
            } catch (e) {
                return null;
            }
        }
        return null;
    },

    // Generic request method
    async request(endpoint, method = 'GET', data = null, options = {}) {
        const config = {
            method,
            url: `/api/v1${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (this.token) {
            config.headers['Authorization'] = `Bearer ${this.token}`;
        }

        if (data) {
            config.data = data;
        }

        // Auto-detect FormData and let browser set Content-Type with boundary
        if (data instanceof FormData) {
            delete config.headers['Content-Type'];
        }

        try {
            const response = await axios(config);
            return response.data;
        } catch (error) {
            console.error('API Error:', error);
            if (error.response?.status === 401) {
                localStorage.removeItem('astr_token');
                localStorage.removeItem('astr_user');
                window.location.href = '/login';
            }
            throw error;
        }
    },

    // Convenience methods
    get(endpoint, options = {}) {
        return this.request(endpoint, 'GET', null, options);
    },

    post(endpoint, data, options = {}) {
        return this.request(endpoint, 'POST', data, options);
    },

    put(endpoint, data, options = {}) {
        return this.request(endpoint, 'PUT', data, options);
    },

    patch(endpoint, data, options = {}) {
        return this.request(endpoint, 'PATCH', data, options);
    },

    delete(endpoint, options = {}) {
        return this.request(endpoint, 'DELETE', null, options);
    }
};

// Expose to window for Alpine.js access
window.api = api;
