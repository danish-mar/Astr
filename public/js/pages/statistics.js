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
            console.log('📊 Statistics page initializing...');
            await this.loadStats();
            console.log('📊 Data loaded, waiting for next tick...');
            // Use $nextTick to ensure DOM elements are ready before rendering charts
            this.$nextTick(() => {
                console.log('📊 Next tick - attempting to render charts...');
                console.log('📊 Charts data:', this.charts);
                this.updateCharts();
            });
        },

        async setRange(newRange) {
            console.log('📊 Changing range to:', newRange);
            this.range = newRange;
            await this.loadStats();
            // Use $nextTick after data reload as well
            this.$nextTick(() => {
                console.log('📊 Range changed - re-rendering charts...');
                this.updateCharts();
            });
        },

        async loadStats() {
            this.loading = true;
            try {
                console.log('📊 Fetching statistics data...');
                const response = await window.api.get(`/statistics/detailed?range=${this.range}`);
                console.log('📊 API Response:', response);
                const data = response.data;

                this.stats = data.stats;
                this.topProducts = data.topProducts;
                this.topEmployees = data.topEmployees;
                this.charts = data.charts;

                console.log('📊 Stats loaded:', {
                    stats: this.stats,
                    topProducts: this.topProducts.length,
                    topEmployees: this.topEmployees.length,
                    revenueTrend: this.charts.revenueTrend?.length,
                    categorySales: this.charts.categorySales?.length
                });

                // Chart rendering moved to $nextTick in init() and setRange()
            } catch (error) {
                console.error('❌ Error loading statistics:', error);
                console.error('❌ Error details:', error.response?.data || error.message);
                window.showNotification('Error loading statistics. Please try again.', 'error');
            } finally {
                this.loading = false;
            }
        },

        formatNumber(num) {
            return new Intl.NumberFormat('en-IN').format(num);
        },

        updateCharts() {
            console.log('📊 updateCharts() called');
            console.log('📊 Revenue chart element exists:', !!document.getElementById('detailedRevenueChart'));
            console.log('📊 Category chart element exists:', !!document.getElementById('categoryChart'));
            this.renderRevenueChart();
            this.renderCategoryChart();
        },

        renderRevenueChart() {
            console.log('📊 renderRevenueChart() called');
            const ctx = document.getElementById('detailedRevenueChart');
            console.log('📊 Revenue chart canvas element:', ctx);
            if (!ctx) {
                console.warn('⚠️ Revenue chart canvas element not found');
                return;
            }

            if (this.revenueChartInstance) {
                console.log('📊 Destroying existing revenue chart');
                this.revenueChartInstance.destroy();
            }

            const labels = this.charts.revenueTrend.map(item => {
                const date = new Date(item._id);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            });
            const data = this.charts.revenueTrend.map(item => item.total);

            console.log('📊 Revenue chart data:', { labels, data });
            console.log('📊 Creating revenue chart...');

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
            console.log('✅ Revenue chart created successfully');
        },

        renderCategoryChart() {
            console.log('📊 renderCategoryChart() called');
            const ctx = document.getElementById('categoryChart');
            console.log('📊 Category chart canvas element:', ctx);
            if (!ctx) {
                console.warn('⚠️ Category chart canvas element not found');
                return;
            }

            if (this.categoryChartInstance) {
                console.log('📊 Destroying existing category chart');
                this.categoryChartInstance.destroy();
            }

            const labels = this.charts.categorySales.map(item => item.name);
            const data = this.charts.categorySales.map(item => item.count);

            console.log('📊 Category chart data:', { labels, data });

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
            console.log('✅ Category chart created successfully');
        }
    }));
});
