function expenditureData() {
    return {
        expenditures: [],
        categories: ["Snacks", "Tea", "Tools", "Transport", "Miscellaneous", "Ad-hoc"],
        stats: {
            byCategory: [],
            todayTotal: 0
        },
        loading: false,
        showStats: false,
        showAddModal: false,
        filter: {
            category: ''
        },
        formData: {
            title: '',
            amount: '',
            category: 'Tea',
            description: ''
        },

        async init() {
            this.loading = true;
            try {
                await Promise.all([
                    this.loadExpenditures(),
                    this.loadStats()
                ]);
            } catch (err) {
                console.error('Init error:', err);
            } finally {
                this.loading = false;
            }
        },

        api(endpoint, method = 'GET', data = null) {
            return this.$store.app.api(endpoint, method, data);
        },

        async loadExpenditures() {
            try {
                let url = '/expenditures';
                if (this.filter.category) {
                    url += `?category=${this.filter.category}`;
                }
                const response = await this.api(url);
                this.expenditures = response.data;
            } catch (err) {
                console.error('Failed to load expenditures:', err);
                window.showNotification('Failed to load expenditures', 'error');
            }
        },

        async loadStats() {
            try {
                const response = await this.api('/expenditures/stats');
                this.stats = response.data;
            } catch (err) {
                console.error('Failed to load stats:', err);
            }
        },

        toggleFilter(category) {
            if (this.filter.category === category) {
                this.filter.category = '';
            } else {
                this.filter.category = category;
            }
            this.loadExpenditures();
        },

        openAddModal() {
            this.showAddModal = true;
            this.formData = {
                title: '',
                amount: '',
                category: 'Tea',
                description: ''
            };
        },

        closeModal() {
            this.showAddModal = false;
        },

        async saveExpense() {
            try {
                await this.api('/expenditures', 'POST', this.formData);
                window.showNotification('Expense logged successfully');
                this.closeModal();
                await this.loadExpenditures();
                await this.loadStats();
            } catch (err) {
                console.error('Failed to save expense:', err);
                window.showNotification(err.response?.data?.message || 'Failed to log expense', 'error');
            }
        },

        async deleteItem(id) {
            window.showConfirm('Delete Entry?', 'This will permanently remove this expense record.', async () => {
                try {
                    await this.api(`/expenditures/${id}`, 'DELETE');
                    window.showNotification('Entry removed');
                    await this.loadExpenditures();
                    await this.loadStats();
                } catch (err) {
                    console.error('Failed to delete expense:', err);
                    window.showNotification('Failed to delete expense', 'error');
                }
            });
        },

        formatDate(dateStr) {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        },

        formatNumber(num) {
            return Number(num || 0).toLocaleString('en-IN');
        },

        calculateTotal() {
            return this.stats.byCategory.reduce((acc, curr) => acc + curr.totalAmount, 0) || 1;
        },

        calculateMonthTotal() {
            return this.stats.byCategory.reduce((acc, curr) => acc + curr.totalAmount, 0);
        }
    };
}
