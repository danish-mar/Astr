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
    async request(endpoint, method = 'GET', data = null) {
        const config = {
            method,
            url: `/api/v1${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (this.token) {
            config.headers['Authorization'] = `Bearer ${this.token}`;
        }

        if (data) {
            config.data = data;
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
    get(endpoint) {
        return this.request(endpoint, 'GET');
    },

    post(endpoint, data) {
        return this.request(endpoint, 'POST', data);
    },

    put(endpoint, data) {
        return this.request(endpoint, 'PUT', data);
    },

    patch(endpoint, data) {
        return this.request(endpoint, 'PATCH', data);
    },

    delete(endpoint) {
        return this.request(endpoint, 'DELETE');
    }
};

// Expose to window for Alpine.js access
window.api = api;
