function expenditureData() {
    return {
        expenditures: [],
        tags: [],
        stats: {
            byTag: [],
            todayTotal: 0
        },
        loading: false,
        showStats: false,
        showAddModal: false,
        showNewTagField: false,
        filter: {
            tagId: '',
            period: 'month' // Default to month
        },
        formData: {
            title: '',
            amount: '',
            tagId: '',
            newTagName: '',
            description: ''
        },

        async init() {
            this.loading = true;
            try {
                await Promise.all([
                    this.loadTags(),
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

        async loadTags() {
            try {
                const response = await this.api('/expenditures/tags');
                this.tags = response.data;
            } catch (err) {
                console.error('Failed to load tags:', err);
            }
        },

        async loadExpenditures() {
            try {
                let url = `/expenditures?period=${this.filter.period}`;
                if (this.filter.tagId) {
                    url += `&tagId=${this.filter.tagId}`;
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
                const response = await this.api(`/expenditures/stats?period=${this.filter.period}`);
                this.stats = response.data;
            } catch (err) {
                console.error('Failed to load stats:', err);
            }
        },

        setPeriod(period) {
            this.filter.period = period;
            this.loadExpenditures();
            this.loadStats();
        },

        getPeriodLabel(format = 'Short') {
            const labels = {
                day: format === 'Short' ? 'Today' : 'Today\'s Spend',
                month: format === 'Short' ? 'This Month' : 'Monthly Spend',
                year: format === 'Short' ? 'This Year' : 'Annual Spend'
            };
            return labels[this.filter.period];
        },

        toggleTagFilter(tagId) {
            this.filter.tagId = this.filter.tagId === tagId ? '' : tagId;
            this.loadExpenditures();
        },

        openAddModal() {
            this.showAddModal = true;
            this.showNewTagField = false;
            this.formData = {
                title: '',
                amount: '',
                tagId: '',
                newTagName: '',
                description: ''
            };
        },

        closeModal() {
            this.showAddModal = false;
        },

        async saveExpense() {
            this.loading = true;
            try {
                await this.api('/expenditures', 'POST', this.formData);
                window.showNotification('Expense logged successfully');
                this.closeModal();
                await Promise.all([
                    this.loadTags(),
                    this.loadExpenditures(),
                    this.loadStats()
                ]);
            } catch (err) {
                console.error('Failed to save expense:', err);
                window.showNotification(err.response?.data?.message || 'Failed to log expense', 'error');
            } finally {
                this.loading = false;
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
            return this.stats.byTag.reduce((acc, curr) => acc + curr.totalAmount, 0) || 1;
        },

        calculateYearlyForecast() {
            // Very simple projection: if month, multiply by 12. If day, multiply by 365.
            const total = this.stats.todayTotal || 0;
            if (this.filter.period === 'day') return total * 365;
            if (this.filter.period === 'month') return total * 12; // This is a bit rough if todayTotal is just current period total
            return total;
        }
    };
}
