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
