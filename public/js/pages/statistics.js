document.addEventListener('alpine:init', () => {
    Alpine.data('statisticsData', () => ({
        range: '30d',
        stats: {
            totalRevenue: 0,
            productRevenue: 0,
            serviceRevenue: 0,
            totalExpenditure: 0,
            revenueGrowth: 0,
            ticketsClosed: 0,
            productsSold: 0,
            avgTicketValue: 0
        },
        topProducts: [],
        topEmployees: [],
        charts: {
            revenueTrend: [],
            expenditureTrend: [],
            categorySales: [],
            expenditureByTag: []
        },
        loading: true,
        revenueChartInstance: null,
        expenditureChartInstance: null,
        categoryChartInstance: null,
        tagChartInstance: null,

        async init() {
            await this.loadStats();
            this.$nextTick(() => {
                this.updateCharts();
            });
        },

        async setRange(newRange) {
            this.range = newRange;
            await this.loadStats();
            this.$nextTick(() => {
                this.updateCharts();
            });
        },

        async loadStats() {
            this.loading = true;
            try {
                const response = await window.api.get(`/statistics/detailed?range=${this.range}`);
                const data = response.data;

                this.stats = data.stats;
                this.topProducts = data.topProducts;
                this.topEmployees = data.topEmployees;
                this.charts = data.charts;
            } catch (error) {
                console.error('Error loading statistics:', error);
                window.showNotification('Error loading statistics', 'error');
            } finally {
                this.loading = false;
            }
        },

        formatNumber(num) {
            return new Intl.NumberFormat('en-IN').format(num);
        },

        updateCharts() {
            this.renderRevenueChart();
            this.renderExpenditureTrendChart();
            this.renderCategoryChart();
            this.renderExpenditureTagChart();
        },

        renderRevenueChart() {
            const ctx = document.getElementById('detailedRevenueChart');
            if (!ctx) return;

            if (this.revenueChartInstance) this.revenueChartInstance.destroy();

            const labels = this.charts.revenueTrend.map(item => {
                const date = new Date(item._id);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            });
            const data = this.charts.revenueTrend.map(item => item.total);

            this.revenueChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Service Revenue (₹)',
                        data: data,
                        backgroundColor: '#10b981',
                        borderRadius: 8,
                        barThickness: 'flex',
                        maxBarThickness: 30
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { borderDash: [2, 2] } },
                        x: { grid: { display: false } }
                    }
                }
            });
        },

        renderExpenditureTrendChart() {
            const ctx = document.getElementById('expenditureTrendChart');
            if (!ctx) return;

            if (this.expenditureChartInstance) this.expenditureChartInstance.destroy();

            const labels = this.charts.expenditureTrend.map(item => {
                const date = new Date(item._id);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            });
            const data = this.charts.expenditureTrend.map(item => item.total);

            this.expenditureChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Expenditure (₹)',
                        data: data,
                        borderColor: '#f43f5e',
                        backgroundColor: '#f43f5e20',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointRadius: 4,
                        pointBackgroundColor: '#fff',
                        pointBorderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { borderDash: [2, 2] } },
                        x: { grid: { display: false } }
                    }
                }
            });
        },

        renderCategoryChart() {
            const ctx = document.getElementById('categoryChart');
            if (!ctx) return;

            if (this.categoryChartInstance) this.categoryChartInstance.destroy();

            const labels = this.charts.categorySales.map(item => item.name);
            const data = this.charts.categorySales.map(item => item.count);

            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

            this.categoryChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: colors.slice(0, labels.length),
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'right' } },
                    cutout: '65%'
                }
            });
        },

        renderExpenditureTagChart() {
            const ctx = document.getElementById('expenditureTagChart');
            if (!ctx) return;

            if (this.tagChartInstance) this.tagChartInstance.destroy();

            const labels = this.charts.expenditureByTag.map(item => item.name);
            const data = this.charts.expenditureByTag.map(item => item.total);

            const colors = ['#f43f5e', '#8b5cf6', '#ec4899', '#f97316', '#6366f1'];

            this.tagChartInstance = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: colors.slice(0, labels.length),
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'right' } }
                }
            });
        }
    }));
});
