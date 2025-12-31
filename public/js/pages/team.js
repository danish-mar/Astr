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
            'Operations': [
                { id: 'tickets:read', label: 'View Tickets', description: 'Access to service ticket index and lists.' },
                { id: 'tickets:write', label: 'Manage Tickets', description: 'Create and update service tickets.' },
                { id: 'accounting:read', label: 'View Ledger', description: 'Access to financial gateway and totals.' },
                { id: 'accounting:write', label: 'Post Vouchers', description: 'Create receipt and payment entries.' },
                { id: 'attendance:view_all', label: 'Audit Attendance', description: 'View attendance records of all staff.' }
            ],
            'Inventory': [
                { id: 'products:read', label: 'View Inventory', description: 'See stock levels and product details.' },
                { id: 'products:write', label: 'Manage Stock', description: 'Add/Edit products and adjust counts.' }
            ],
            'CRM': [
                { id: 'contacts:read', label: 'View Contacts', description: 'Access client and vendor records.' },
                { id: 'contacts:write', label: 'Manage Contacts', description: 'Create and modify relationship data.' },
                { id: 'leads:read', label: 'View leads', description: 'Access to sales lead pipeline.' }
            ],
            'System': [
                { id: 'settings:manage', label: 'Shop Settings', description: 'Modify shop identity and branding.' },
                { id: 'ai:manage', label: 'AI Control', description: 'Configure AI models and keys.' },
                { id: 'payroll:manage', label: 'Financial Control', description: 'Calculate and view staff payroll.' }
            ]
        },

        groups: ['General', 'Sales', 'Technician', 'Mobile Repair', 'Floor', 'Backend'],

        async init() {
            await this.loadUsers();
            await this.loadAttendanceStatus();
            await this.loadAura();

            // Poll for aura every 5 minutes
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
                console.error('Failed to load users:', error);
            } finally {
                this.loading = false;
            }
        },

        async loadAttendanceStatus() {
            try {
                const response = await this.$store.app.api('/attendance/status');
                // Ensure attendanceStatus is an object even if empty
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
            return this.users.filter(user => {
                const groupMatch = this.filters.group === 'All' || user.group === this.filters.group;
                const statusMatch = this.filters.showResigned || user.status !== 'Resigned';
                return groupMatch && statusMatch;
            });
        },

        async performCheckIn() {
            try {
                await this.$store.app.api('/attendance/check-in', 'POST');
                window.showNotification('Shift Signal Transmitted');
                await this.loadAttendanceStatus();
                await this.loadAura();
            } catch (error) {
                window.showNotification(error.response?.data?.message || 'Signal disruption', 'error');
            }
        },

        async performCheckOut() {
            try {
                await this.$store.app.api('/attendance/check-out', 'POST');
                window.showNotification('Shift Signal Terminated');
                await this.loadAttendanceStatus();
                await this.loadAura();
            } catch (error) {
                window.showNotification(error.response?.data?.message || 'Signal disruption', 'error');
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
                window.showNotification(this.editMode ? 'Unit Recalibrated' : 'Unit Deployed');
                this.modals.user = false;
                await this.loadUsers();
            } catch (error) {
                window.showNotification(error.response?.data?.message || 'Deployment failure', 'error');
            } finally {
                this.saving = false;
            }
        },

        async updateStatus(user, status) {
            const action = status === 'Resigned' ? 'relieve' : 'restore';
            window.showConfirm('Confirm Governance', `Are you sure you want to ${action} ${user.name}?`, async () => {
                try {
                    await this.$store.app.api(`/employees/${user._id}/status`, 'PUT', { status });
                    window.showNotification('Governance policy applied');
                    await this.loadUsers();
                } catch (error) {
                    window.showNotification('Policy application failed', 'error');
                }
            });
        },

        async syncLedger(user) {
            try {
                await this.$store.app.api(`/employees/${user._id}/sync-ledger`, 'POST');
                window.showNotification('Bond established with financial layer');
                await this.loadUsers();
            } catch (error) {
                window.showNotification('Linkage failure', 'error');
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
            try {
                await this.$store.app.api(`/employees/${this.selectedUser._id}/reset-password`, 'PUT', {
                    newPassword: this.passwordForm.newPassword
                });
                window.showNotification('Master Key rotated');
                this.modals.password = false;
            } catch (error) {
                window.showNotification('Rotation failed', 'error');
            }
        },

        async savePermissions() {
            try {
                await this.$store.app.api(`/employees/${this.selectedUser._id}/permissions`, 'PUT', {
                    permissions: this.selectedPermissions
                });
                window.showNotification('Guard rules synchronized');
                this.modals.permissions = false;
                await this.loadUsers();
            } catch (error) {
                window.showNotification('Rule sync failure', 'error');
            }
        },

        async deleteUser(user) {
            window.showConfirm('Wipe Record', `Wipe all system data for ${user.name}? This action is irreversible.`, async () => {
                try {
                    await this.$store.app.api(`/employees/${user._id}`, 'DELETE');
                    window.showNotification('Personnel data purged');
                    await this.loadUsers();
                } catch (error) {
                    window.showNotification('Purge failure', 'error');
                }
            });
        },

        permList(perms) {
            return perms || [];
        }
    }));
});
