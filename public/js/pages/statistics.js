document.addEventListener('alpine:init', () => {
    Alpine.data('statisticsData', () => ({
        range: '30d',
        stats: {
            totalRevenue: 0,
            revenueGrowth: 0,
            ticketsClosed: 0,
            productsSold: 0,
            avgTicketValue: 0
        },
        topProducts: [],
        topEmployees: [],
        charts: {
            revenueTrend: [],
            categorySales: []
        },
        loading: true,
        revenueChartInstance: null,
        categoryChartInstance: null,

        async init() {
            await this.loadStats();
        },

        async setRange(newRange) {
            this.range = newRange;
            await this.loadStats();
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

                this.updateCharts();
            } catch (error) {
                console.error('Error loading statistics:', error);
            } finally {
                this.loading = false;
            }
        },

        formatNumber(num) {
            return new Intl.NumberFormat('en-IN').format(num);
        },

        updateCharts() {
            this.renderRevenueChart();
            this.renderCategoryChart();
        },

        renderRevenueChart() {
            const ctx = document.getElementById('detailedRevenueChart');
            if (!ctx) return;

            if (this.revenueChartInstance) {
                this.revenueChartInstance.destroy();
            }

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
                        label: 'Revenue (₹)',
                        data: data,
                        backgroundColor: '#10b981',
                        borderRadius: 4,
                        barThickness: 'flex',
                        maxBarThickness: 40
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(context.parsed.y);
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { borderDash: [2, 2] }
                        },
                        x: {
                            grid: { display: false }
                        }
                    }
                }
            });
        },

        renderCategoryChart() {
            const ctx = document.getElementById('categoryChart');
            if (!ctx) return;

            if (this.categoryChartInstance) {
                this.categoryChartInstance.destroy();
            }

            const labels = this.charts.categorySales.map(item => item.name);
            const data = this.charts.categorySales.map(item => item.count);

            // Generate colors
            const colors = [
                '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
                '#ec4899', '#06b6d4', '#14b8a6', '#6366f1', '#d946ef'
            ];

            this.categoryChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: colors.slice(0, labels.length),
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                usePointStyle: true,
                                padding: 20
                            }
                        }
                    },
                    cutout: '65%'
                }
            });
        }
    }));
});
