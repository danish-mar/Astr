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

                // Create purple gradient
                const gradient = ctx.createLinearGradient(0, 0, 0, 320);
                gradient.addColorStop(0, 'rgba(109, 40, 217, 0.15)');
                gradient.addColorStop(1, 'rgba(109, 40, 217, 0)');

                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: this.charts.revenueTrend.map(d => {
                            const date = new Date(d._id);
                            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        }),
                        datasets: [{
                            label: 'Revenue',
                            data: this.charts.revenueTrend.map(d => d.total),
                            borderColor: '#6d28d9',
                            backgroundColor: gradient,
                            borderWidth: 2.5,
                            tension: 0.4,
                            pointBackgroundColor: '#ffffff',
                            pointBorderColor: '#6d28d9',
                            pointBorderWidth: 2,
                            pointRadius: 5,
                            pointHoverRadius: 7,
                            pointHoverBorderWidth: 3,
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
                                backgroundColor: '#ffffff',
                                titleColor: '#1e293b',
                                bodyColor: '#64748b',
                                borderColor: '#e2e8f0',
                                borderWidth: 1,
                                padding: 12,
                                cornerRadius: 8,
                                displayColors: false,
                                titleFont: {
                                    size: 13,
                                    weight: 'bold'
                                },
                                bodyFont: {
                                    size: 14,
                                    weight: 'bold'
                                },
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
                                    color: '#f1f5f9',
                                    drawBorder: false,
                                },
                                ticks: {
                                    font: {
                                        family: "'Outfit', sans-serif",
                                        size: 12
                                    },
                                    color: '#94a3b8',
                                    padding: 8,
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
                                        family: "'Outfit', sans-serif",
                                        size: 12
                                    },
                                    color: '#94a3b8',
                                    padding: 8
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