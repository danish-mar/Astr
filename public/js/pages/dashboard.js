document.addEventListener('alpine:init', () => {
    Alpine.data('dashboardData', () => ({
        stats: {
            products: { total: 0, available: 0, sold: 0 },
            tickets: { total: 0, pending: 0, completed: 0 },
            revenue: 0
        },
        recentProducts: [],
        recentTickets: [],
        charts: {
            ticketStatus: [],
            revenueTrend: []
        },
        user: { name: 'User' },
        loading: true,

        async init() {
            // Get user from local storage or store
            const userStr = localStorage.getItem('astr_user');
            if (userStr) {
                try {
                    this.user = JSON.parse(userStr);
                } catch (e) {
                    console.error('Error parsing user data', e);
                }
            }
            await this.loadStats();
        },

        async loadStats() {
            try {
                // We need to create a route for fetching dashboard stats
                // Assuming /api/v1/statistics/dashboard will be created
                const response = await window.api.get('/statistics/dashboard');
                const data = response.data;

                this.stats = data.stats;
                this.recentProducts = data.recentProducts;
                this.recentTickets = data.recentTickets;
                this.charts = data.charts;

                this.initCharts();
            } catch (error) {
                console.error('Error loading dashboard stats:', error);
            } finally {
                this.loading = false;
            }
        },

        formatNumber(num) {
            return new Intl.NumberFormat('en-IN').format(num);
        },

        initCharts() {
            // Revenue Chart
            const revenueCtx = document.getElementById('revenueChart');
            if (revenueCtx && this.charts.revenueTrend) {
                const labels = this.charts.revenueTrend.map(item => {
                    const date = new Date(item._id);
                    return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
                });
                const data = this.charts.revenueTrend.map(item => item.total);

                new Chart(revenueCtx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Revenue (₹)',
                            data: data,
                            borderColor: '#10b981', // primary-500
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            borderWidth: 2,
                            tension: 0.4,
                            fill: true,
                            pointBackgroundColor: '#fff',
                            pointBorderColor: '#10b981',
                            pointRadius: 4
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
            }

            // Status Chart
            const statusCtx = document.getElementById('statusChart');
            if (statusCtx && this.charts.ticketStatus) {
                const labels = this.charts.ticketStatus.map(item => item._id);
                const data = this.charts.ticketStatus.map(item => item.count);

                // Define colors for statuses
                const colors = {
                    'Pending': '#f59e0b', // amber-500
                    'In Progress': '#3b82f6', // blue-500
                    'Completed': '#10b981', // green-500
                    'Delivered': '#a855f7', // purple-500
                    'Cancelled': '#ef4444' // red-500
                };

                const bgColors = labels.map(status => colors[status] || '#9ca3af');

                new Chart(statusCtx, {
                    type: 'doughnut',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: data,
                            backgroundColor: bgColors,
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
                        cutout: '70%'
                    }
                });
            }
        }
    }));
});
