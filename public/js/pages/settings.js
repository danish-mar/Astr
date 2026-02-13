document.addEventListener('alpine:init', () => {
    Alpine.data('settingsData', () => ({
        activeTab: 'general',
        settings: {
            shopName: '',
            themeColor: '#3B82F6',
            phone: '',
            email: '',
            address: '',
            aiProvider: 'none',
            aiApiKey: '',
            aiEnabled: false
        },
        saving: false,
        showApiKey: false,
        testingConnection: false,
        connectionTestResult: false,
        connectionTestSuccess: false,
        connectionTestMessage: '',

        async init() {
            try {
                const response = await window.api.get('/settings');
                if (response.success && response.data.settings) {
                    this.settings = { ...this.settings, ...response.data.settings };
                }
            } catch (error) {
                console.error('Failed to load settings:', error);
                window.showNotification('error', 'Failed to load settings');
            }
        },

        async saveSettings() {
            this.saving = true;
            try {
                const response = await window.api.put('/settings', this.settings);
                if (response.success) {
                    window.showNotification('success', 'Settings updated successfully');
                    // Update global shop name if it's displayed elsewhere
                    if (this.settings.shopName) {
                        document.querySelectorAll('.shop-name-display').forEach(el => {
                            el.textContent = this.settings.shopName;
                        });
                    }
                }
            } catch (error) {
                console.error('Failed to save settings:', error);
                window.showNotification('error', error.response?.data?.message || 'Failed to save settings');
            } finally {
                this.saving = false;
            }
        },

        async deleteUser(user) {
            // Logic removed - migrated to /team
        },

        async testAIConnection() {
            this.testingConnection = true;
            this.connectionTestResult = false;
            try {
                const response = await window.api.post('/ai/test-connection');
                this.connectionTestSuccess = true;
                this.connectionTestMessage = response.message || 'Connection successful!';
                this.connectionTestResult = true;
            } catch (error) {
                this.connectionTestSuccess = false;
                this.connectionTestMessage = error.response?.data?.message || 'Connection failed. Please check your API key.';
                this.connectionTestResult = true;
            } finally {
                this.testingConnection = false;
            }
        }
    }));
});
