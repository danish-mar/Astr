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
                const ctx = revenueCtx.getContext('2d');

                // Create gradient
                const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                gradient.addColorStop(0, 'rgba(0, 122, 255, 0.2)'); // Primary Blue
                gradient.addColorStop(1, 'rgba(0, 122, 255, 0)');

                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: this.charts.revenueTrend.map(d => {
                            const date = new Date(d._id);
                            return date.toLocaleDateString('en-US', { weekday: 'short' });
                        }),
                        datasets: [{
                            label: 'Revenue',
                            data: this.charts.revenueTrend.map(d => d.total),
                            borderColor: '#007aff', // Primary Blue
                            backgroundColor: gradient,
                            borderWidth: 3,
                            tension: 0.4, // Smooth curve
                            pointBackgroundColor: '#ffffff',
                            pointBorderColor: '#007aff',
                            pointBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            fill: true
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                titleColor: '#1f2937',
                                bodyColor: '#4b5563',
                                borderColor: 'rgba(0,0,0,0.05)',
                                borderWidth: 1,
                                padding: 12,
                                cornerRadius: 12,
                                displayColors: false,
                                callbacks: {
                                    label: function (context) {
                                        return '₹' + context.parsed.y.toLocaleString('en-IN');
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.03)',
                                    drawBorder: false,
                                },
                                ticks: {
                                    font: {
                                        family: "'Inter', sans-serif",
                                        size: 11
                                    },
                                    color: '#9ca3af',
                                    callback: function (value) {
                                        if (value >= 1000) return '₹' + (value / 1000) + 'k';
                                        return '₹' + value;
                                    }
                                },
                                border: {
                                    display: false
                                }
                            },
                            x: {
                                grid: {
                                    display: false,
                                    drawBorder: false,
                                },
                                ticks: {
                                    font: {
                                        family: "'Inter', sans-serif",
                                        size: 11
                                    },
                                    color: '#9ca3af'
                                },
                                border: {
                                    display: false
                                }
                            }
                        },
                        interaction: {
                            intersect: false,
                            mode: 'index',
                        },
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
                    'Pending': '#fbbf24', // Amber
                    'In Progress': '#3b82f6', // Blue
                    'Completed': '#34c759', // Green
                    'Delivered': '#a855f7', // Purple
                    'Cancelled': '#ff3b30' // Red
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
                        cutout: '75%',
                        borderRadius: 20,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    usePointStyle: true,
                                    padding: 20,
                                    font: {
                                        family: "'Inter', sans-serif",
                                        size: 12
                                    },
                                    color: '#6b7280'
                                }
                            },
                            tooltip: {
                                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                bodyColor: '#4b5563',
                                borderColor: 'rgba(0,0,0,0.05)',
                                borderWidth: 1,
                                padding: 12,
                                cornerRadius: 12,
                                displayColors: true,
                                callbacks: {
                                    label: function (context) {
                                        return ' ' + context.label + ': ' + context.parsed;
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }
    }));
});
