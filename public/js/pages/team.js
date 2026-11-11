document.addEventListener('alpine:init', () => {
    Alpine.data('teamData', () => ({
        users: [],
        loading: false,
        saving: false,

        modals: {
            user: false,
            password: false,
            permissions: false,
            profile: false
        },

        filters: {
            search: '',
            group: 'All',
            showResigned: false
        },

        editMode: false,
        selectedUser: null,
        selectedPermissions: [],
        attendanceStatus: null,
        payrollData: null,
        activeAuraIds: [],

        userForm: {
            name: '',
            username: '',
            password: '',
            position: 'Staff',
            group: 'General',
            salaryConfig: {
                type: 'monthly',
                amount: 0
            }
        },

        passwordForm: {
            newPassword: ''
        },

        permissionTree: {
            'Service Tickets': [
                { id: 'tickets:read', label: 'View Tickets', description: 'Access to service tickets list and details.' },
                { id: 'tickets:write', label: 'Manage Tickets', description: 'Create, edit, and update ticket status.' }
            ],
            'Accounting & Ledger': [
                { id: 'accounting:read', label: 'View Ledger', description: 'Access to accounts, balance, and entries.' },
                { id: 'accounting:write', label: 'Post Vouchers', description: 'Create receipt and payment transactions.' },
                { id: 'payroll:manage', label: 'Payroll Management', description: 'Calculate and process employee payroll.' }
            ],
            'Attendance': [
                { id: 'attendance:view_all', label: 'View All Attendance', description: 'View shift logs for all staff members.' }
            ],
            'Inventory': [
                { id: 'products:read', label: 'View Inventory', description: 'Browse products, stock, and pricing.' },
                { id: 'products:write', label: 'Manage Stock', description: 'Add, update products, and adjust stock counts.' }
            ],
            'Contacts & CRM': [
                { id: 'contacts:read', label: 'View Contacts', description: 'Access customer and supplier details.' },
                { id: 'contacts:write', label: 'Manage Contacts', description: 'Create and update customer profiles.' },
                { id: 'leads:read', label: 'View Leads', description: 'Access sales inquiry pipeline.' }
            ],
            'System Settings': [
                { id: 'settings:manage', label: 'Shop Settings', description: 'Configure workshop and business profile.' },
                { id: 'ai:manage', label: 'AI Settings', description: 'Manage AI Copilot configuration and tools.' }
            ]
        },

        groups: ['General', 'Sales', 'Technician', 'Mobile Repair', 'Floor', 'Backend'],

        async init() {
            await this.loadUsers();
            await this.loadAttendanceStatus();
            await this.loadAura();

            // Refresh status periodically every 5 minutes
            setInterval(() => {
                this.loadAttendanceStatus();
                this.loadAura();
            }, 300000);
        },

        async loadUsers() {
            this.loading = true;
            try {
                const response = await this.$store.app.api('/employees');
                this.users = response.data || response;
                if (this.users.data) this.users = this.users.data;
            } catch (error) {
                console.error('Failed to load employees:', error);
            } finally {
                this.loading = false;
            }
        },

        async loadAttendanceStatus() {
            try {
                const response = await this.$store.app.api('/attendance/status');
                this.attendanceStatus = response.data || {};
            } catch (error) {
                this.attendanceStatus = {};
            }
        },

        async loadAura() {
            try {
                const response = await this.$store.app.api('/attendance/aura');
                this.activeAuraIds = response.data || [];
            } catch (error) {
                this.activeAuraIds = [];
            }
        },

        filteredUsers() {
            if (!this.users) return [];
            const q = (this.filters.search || '').trim().toLowerCase();
            return this.users.filter(user => {
                const groupMatch = this.filters.group === 'All' || user.group === this.filters.group;
                const statusMatch = this.filters.showResigned || user.status !== 'Resigned';
                const searchMatch = !q ||
                    (user.name && user.name.toLowerCase().includes(q)) ||
                    (user.username && user.username.toLowerCase().includes(q)) ||
                    (user.position && user.position.toLowerCase().includes(q)) ||
                    (user.group && user.group.toLowerCase().includes(q));
                return groupMatch && statusMatch && searchMatch;
            });
        },

        async performCheckIn() {
            try {
                await this.$store.app.api('/attendance/check-in', 'POST');
                window.showNotification('Shift started');
                await this.loadAttendanceStatus();
                await this.loadAura();
            } catch (error) {
                window.showNotification(error.response?.data?.message || 'Could not start shift', 'error');
            }
        },

        async performCheckOut() {
            try {
                await this.$store.app.api('/attendance/check-out', 'POST');
                window.showNotification('Shift ended');
                await this.loadAttendanceStatus();
                await this.loadAura();
            } catch (error) {
                window.showNotification(error.response?.data?.message || 'Could not end shift', 'error');
            }
        },

        openUserModal(user = null) {
            this.editMode = !!user;
            if (user) {
                this.selectedUser = user;
                this.userForm = {
                    name: user.name,
                    username: user.username,
                    position: user.position || 'Staff',
                    group: user.group || 'General',
                    salaryConfig: user.salaryConfig ? { ...user.salaryConfig } : { type: 'monthly', amount: 0 }
                };
            } else {
                this.userForm = {
                    name: '',
                    username: '',
                    password: '',
                    position: 'Staff',
                    group: 'General',
                    salaryConfig: { type: 'monthly', amount: 0 }
                };
            }
            this.modals.user = true;
        },

        async saveUser() {
            this.saving = true;
            try {
                const url = this.editMode ? `/employees/${this.selectedUser._id}` : '/employees';
                const method = this.editMode ? 'PUT' : 'POST';

                await this.$store.app.api(url, method, this.userForm);
                window.showNotification(this.editMode ? 'Employee updated' : 'Employee added');
                this.modals.user = false;
                await this.loadUsers();
            } catch (error) {
                window.showNotification(error.response?.data?.message || 'Failed to save employee', 'error');
            } finally {
                this.saving = false;
            }
        },

        async updateStatus(user, status) {
            const actionText = status === 'Resigned' ? 'mark as resigned' : 'reactivate';
            window.showConfirm('Update Status', `Are you sure you want to ${actionText} ${user.name}?`, async () => {
                try {
                    await this.$store.app.api(`/employees/${user._id}/status`, 'PUT', { status });
                    window.showNotification('Employee status updated');
                    await this.loadUsers();
                } catch (error) {
                    window.showNotification('Failed to update status', 'error');
                }
            });
        },

        async syncLedger(user) {
            try {
                await this.$store.app.api(`/employees/${user._id}/sync-ledger`, 'POST');
                window.showNotification('Accounts ledger linked');
                await this.loadUsers();
            } catch (error) {
                window.showNotification('Failed to link ledger', 'error');
            }
        },

        async viewProfile(user) {
            this.selectedUser = user;
            this.modals.profile = true;

            const now = new Date();
            const month = now.getMonth() + 1;
            const year = now.getFullYear();

            try {
                const response = await this.$store.app.api(`/attendance/payroll?month=${month}&year=${year}&employeeId=${user._id}`);
                this.payrollData = response.data;
            } catch (error) {
                this.payrollData = null;
            }
        },

        openPermissionMatrix(user) {
            this.selectedUser = user;
            this.selectedPermissions = user.permissions || [];
            this.modals.permissions = true;
        },

        openPasswordReset(user) {
            this.selectedUser = user;
            this.passwordForm.newPassword = '';
            this.modals.password = true;
        },

        async resetPassword() {
            if (!this.passwordForm.newPassword) {
                window.showNotification('Please enter a new password', 'warning');
                return;
            }
            try {
                await this.$store.app.api(`/employees/${this.selectedUser._id}/reset-password`, 'PUT', {
                    newPassword: this.passwordForm.newPassword
                });
                window.showNotification('Password updated successfully');
                this.modals.password = false;
            } catch (error) {
                window.showNotification(error.response?.data?.message || 'Failed to reset password', 'error');
            }
        },

        async savePermissions() {
            try {
                await this.$store.app.api(`/employees/${this.selectedUser._id}/permissions`, 'PUT', {
                    permissions: this.selectedPermissions
                });
                window.showNotification('Permissions updated');
                this.modals.permissions = false;
                await this.loadUsers();
            } catch (error) {
                window.showNotification('Failed to save permissions', 'error');
            }
        },

        async deleteUser(user) {
            window.showConfirm('Delete Employee', `Are you sure you want to delete ${user.name}? This action cannot be undone.`, async () => {
                try {
                    await this.$store.app.api(`/employees/${user._id}`, 'DELETE');
                    window.showNotification('Employee deleted');
                    await this.loadUsers();
                } catch (error) {
                    window.showNotification(error.response?.data?.message || 'Failed to delete employee', 'error');
                }
            });
        },

        permList(perms) {
            return perms || [];
        }
    }));
});
