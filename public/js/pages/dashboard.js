document.addEventListener('alpine:init', () => {
    Alpine.data('dashboardData', () => ({
        stats: {
            products: { total: 0, available: 0, sold: 0 },
            tickets: { total: 0, pending: 0, completed: 0, active: 0 },
            contacts: 0,
            revenue: 0
        },
        recentProducts: [],
        recentTickets: [],
        charts: {
            ticketStatus: [],
            revenueTrend: []
        },
        trendRange: '7d',
        trendLoading: false,
        trendSummary: {
            total: 0,
            dailyAverage: 0,
            highestDay: null
        },
        revenueChartInstance: null,
        statusChartInstance: null,
        user: { name: 'User' },
        loading: true,

        async init() {
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
                const response = await window.api.get('/statistics/dashboard?range=' + this.trendRange);
                const data = response.data;

                this.stats = data.stats;
                this.recentProducts = data.recentProducts;
                this.recentTickets = data.recentTickets;
                this.charts = data.charts;
                if (data.charts.trendSummary) {
                    this.trendSummary = data.charts.trendSummary;
                }

                this.initCharts();
            } catch (error) {
                console.error('Error loading dashboard stats:', error);
            } finally {
                this.loading = false;
            }
        },

        async changeTrendRange(range) {
            if (this.trendRange === range || this.trendLoading) return;
            this.trendRange = range;
            this.trendLoading = true;
            try {
                const response = await window.api.get('/statistics/dashboard?range=' + range);
                if (response && response.data) {
                    this.charts.revenueTrend = response.data.charts.revenueTrend;
                    if (response.data.charts.trendSummary) {
                        this.trendSummary = response.data.charts.trendSummary;
                    }
                    this.renderRevenueChart();
                }
            } catch (error) {
                console.error('Error changing trend range:', error);
            } finally {
                this.trendLoading = false;
            }
        },

        formatNumber(num) {
            return new Intl.NumberFormat('en-IN').format(num || 0);
        },

        initCharts() {
            this.renderRevenueChart();
            this.renderStatusChart();
        },

        renderRevenueChart() {
            const revenueCtx = document.getElementById('revenueChart');
            if (!revenueCtx || !this.charts.revenueTrend) return;

            if (this.revenueChartInstance) {
                this.revenueChartInstance.destroy();
                this.revenueChartInstance = null;
            }

            const ctx = revenueCtx.getContext('2d');
            const trendData = this.charts.revenueTrend;

            // Gradient fill
            const gradient = ctx.createLinearGradient(0, 0, 0, 280);
            gradient.addColorStop(0, 'rgba(124, 58, 237, 0.22)');
            gradient.addColorStop(0.65, 'rgba(124, 58, 237, 0.04)');
            gradient.addColorStop(1, 'rgba(124, 58, 237, 0.0)');

            // Calculate max value for sensible scale boundaries
            const values = trendData.map(d => Number(d.total) || 0);
            const maxVal = Math.max(0, ...values);
            const suggestedMax = maxVal > 0 ? Math.ceil((maxVal * 1.25) / 1000) * 1000 : 5000;

            this.revenueChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: trendData.map(d => d.label || d._id),
                    datasets: [{
                        label: 'Revenue',
                        data: values,
                        borderColor: '#7c3aed',
                        backgroundColor: gradient,
                        borderWidth: 2.5,
                        tension: 0.38,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: '#7c3aed',
                        pointBorderWidth: 2,
                        pointRadius: this.trendRange === '30d' ? 2.5 : 4.5,
                        pointHoverRadius: 6.5,
                        pointHoverBackgroundColor: '#7c3aed',
                        pointHoverBorderColor: '#ffffff',
                        pointHoverBorderWidth: 2.5,
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
                            backgroundColor: '#0f172a',
                            titleColor: '#f8fafc',
                            bodyColor: '#cbd5e1',
                            borderColor: '#334155',
                            borderWidth: 1,
                            padding: 12,
                            cornerRadius: 10,
                            displayColors: false,
                            titleFont: {
                                family: "'Outfit', sans-serif",
                                size: 12,
                                weight: '600'
                            },
                            bodyFont: {
                                family: "'Outfit', sans-serif",
                                size: 13,
                                weight: '500'
                            },
                            callbacks: {
                                title: (items) => {
                                    const item = items[0];
                                    const d = trendData[item.dataIndex];
                                    return d ? `${d.dayName}, ${d.label}` : item.label;
                                },
                                label: (context) => {
                                    const d = trendData[context.dataIndex];
                                    const totalFormatted = 'Total: ₹' + Number(context.parsed.y).toLocaleString('en-IN');
                                    if (d && (d.services > 0 || d.products > 0)) {
                                        const lines = [totalFormatted];
                                        if (d.services > 0) lines.push(`• Repairs: ₹${Number(d.services).toLocaleString('en-IN')}`);
                                        if (d.products > 0) lines.push(`• Sales: ₹${Number(d.products).toLocaleString('en-IN')}`);
                                        return lines;
                                    }
                                    return totalFormatted;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            suggestedMin: 0,
                            suggestedMax: suggestedMax,
                            grid: {
                                color: '#f1f5f9',
                                drawBorder: false,
                            },
                            ticks: {
                                precision: 0,
                                font: {
                                    family: "'Outfit', sans-serif",
                                    size: 11,
                                    weight: '500'
                                },
                                color: '#94a3b8',
                                padding: 8,
                                callback: function (value) {
                                    if (value === 0) return '₹0';
                                    if (value >= 100000) return '₹' + (value / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
                                    if (value >= 1000) return '₹' + Math.round(value / 1000) + 'k';
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
                                    size: 11,
                                    weight: '500'
                                },
                                color: '#94a3b8',
                                padding: 8,
                                maxRotation: 0,
                                autoSkip: true,
                                maxTicksLimit: this.trendRange === '30d' ? 8 : 7,
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
        },

        renderStatusChart() {
            const statusCtx = document.getElementById('statusChart');
            if (!statusCtx || !this.charts.ticketStatus) return;

            if (this.statusChartInstance) {
                this.statusChartInstance.destroy();
                this.statusChartInstance = null;
            }

            const labels = this.charts.ticketStatus.map(item => item._id);
            const data = this.charts.ticketStatus.map(item => item.count);

            const colors = {
                'Pending': '#fbbf24',
                'In Progress': '#3b82f6',
                'Completed': '#34c759',
                'Delivered': '#a855f7',
                'Cancelled': '#ff3b30'
            };

            const bgColors = labels.map(status => colors[status] || '#9ca3af');

            this.statusChartInstance = new Chart(statusCtx, {
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
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
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
    }));
});