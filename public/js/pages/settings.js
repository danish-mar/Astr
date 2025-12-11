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
        users: [],
        showUserModal: false,
        editMode: false,
        userForm: {
            name: '',
            username: '',
            password: '',
            position: 'Staff',
            email: ''
        },
        saving: false,
        loading: false,
        // AI Settings
        showApiKey: false,
        testingConnection: false,
        connectionTestResult: false,
        connectionTestSuccess: false,
        connectionTestMessage: '',

        async init() {
            await this.loadSettings();
            await this.loadUsers();
        },

        async loadSettings() {
            try {
                const response = await window.api.get('/settings');
                this.settings = response.data;
                // Apply theme color immediately
                if (this.settings.themeColor) {
                    document.documentElement.style.setProperty('--primary-color', this.settings.themeColor);
                }
            } catch (error) {
                console.error('Error loading settings:', error);
            }
        },

        async saveSettings() {
            this.saving = true;
            try {
                const response = await window.api.put('/settings', this.settings);
                this.settings = response.data;
                window.showNotification('Settings saved successfully');
                // Reload to apply changes globally (like title)
                window.location.reload();
            } catch (error) {
                window.showNotification('Error saving settings: ' + (error.response?.data?.message || error.message), 'error');
            } finally {
                this.saving = false;
            }
        },

        async loadUsers() {
            // Assuming there's an endpoint to get all employees. 
            // If not, we might need to create one or use an existing one.
            // For now, let's assume /api/auth/users exists or similar.
            // Wait, the plan said "List of employees with 'Add User' modal (using employeeController API)".
            // I need to check if there is a route to get all users.
            // Checking employeeController... it has findByPosition but maybe not getAll.
            // Let's assume we need to add a route for getting all users or use a specific one.
            // For now, I'll try /api/auth/employees if it exists, or just /api/auth/users.
            // Actually, I should check the auth routes.
            try {
                const response = await window.api.get('/employees');
                this.users = response.data;
            } catch (error) {
                console.error('Error loading users:', error);
            }
        },

        openUserModal() {
            this.editMode = false;
            this.userForm = {
                name: '',
                username: '',
                password: '',
                position: 'Staff',
                email: ''
            };
            this.showUserModal = true;
        },

        editUser(user) {
            this.editMode = true;
            this.userForm = {
                _id: user._id,
                name: user.name,
                username: user.username,
                position: user.position,
                email: user.email || ''
            };
            this.showUserModal = true;
        },

        closeUserModal() {
            this.showUserModal = false;
        },

        async saveUser() {
            this.saving = true;
            try {
                if (this.editMode) {
                    await window.api.put(`/employees/${this.userForm._id}`, this.userForm);
                    window.showNotification('User updated successfully');
                } else {
                    await window.api.post('/employees', this.userForm); // Using register endpoint
                    window.showNotification('User created successfully');
                }
                this.closeUserModal();
                this.loadUsers();
            } catch (error) {
                window.showNotification('Error saving user: ' + (error.response?.data?.message || error.message), 'error');
            } finally {
                this.saving = false;
            }
        },

        async toggleUserStatus(user) {
            const action = user.isActive ? 'deactivate' : 'activate';
            window.showConfirm(`${action.charAt(0).toUpperCase() + action.slice(1)} User`, `Are you sure you want to ${action} this user?`, async () => {
                try {
                    await window.api.put(`/employees/${user._id}`, { isActive: !user.isActive });
                    await this.loadUsers();
                    window.showNotification(`User ${action}d successfully`);
                } catch (error) {
                    window.showNotification('Error updating user status: ' + (error.response?.data?.message || error.message), 'error');
                }
            });
        },

        async deleteUser(user) {
            window.showConfirm('Delete User', `Are you sure you want to permanently delete ${user.name}? This action cannot be undone.`, async () => {
                try {
                    await window.api.delete(`/employees/${user._id}/permanent`);
                    window.showNotification('User deleted successfully');
                    await this.loadUsers();
                } catch (error) {
                    window.showNotification('Error deleting user: ' + (error.response?.data?.message || error.message), 'error');
                }
            });
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
