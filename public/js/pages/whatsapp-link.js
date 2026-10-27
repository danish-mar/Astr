document.addEventListener('alpine:init', () => {
    Alpine.data('whatsappLink', () => ({
        status: 'INITIALIZING', // INITIALIZING, AUTHENTICATED, READY, DISCONNECTED
        qrCode: null,
        pollingInterval: null,
        lastQr: null,
        loadingPercent: 0,
        loadingMessage: '',
        
        // Sales & Inquiries Data
        metrics: {
            todayInquiries: 0,
            todayDeals: 0,
            todaySales: 0,
            todayProfit: 0,
            totalDeals: 0,
            totalSales: 0,
            totalProfit: 0,
        },
        inquiries: [],
        filterStatus: 'all',
        selectedInquiry: null,
        isSalesLoading: false,

        get statusText() {
            switch (this.status) {
                case 'READY': return 'Registry Active';
                case 'AUTHENTICATED': 
                    return this.loadingPercent > 0 
                        ? `Validating & Syncing (${this.loadingPercent}%)...` 
                        : 'Validating session...';
                case 'INITIALIZING': return this.qrCode ? 'Awaiting Scan' : 'Warming up...';
                case 'DISCONNECTED': return 'Disconnected';
                default: return 'Initializing...';
            }
        },

        get filteredInquiries() {
            if (this.filterStatus === 'all') return this.inquiries;
            return this.inquiries.filter(i => i.status === this.filterStatus);
        },

        async init() {
            await this.fetchStatus();
            await this.fetchSales();
            // Poll every 3.5 seconds for status & sales updates
            this.pollingInterval = setInterval(() => {
                this.fetchStatus();
                this.fetchSales();
            }, 3500);
        },

        async retry(cleanSession = false) {
            this.status = 'INITIALIZING';
            this.qrCode = null;
            this.loadingPercent = 0;
            this.loadingMessage = '';
            try {
                await this.$store.app.api('/whatsapp/initialize', 'POST', { cleanSession });
                window.showNotification('info', cleanSession ? 'Resetting session and regenerating QR...' : 'Retrying connection...');
                setTimeout(() => {
                    this.fetchStatus();
                    this.fetchSales();
                }, 1000);
            } catch (error) {
                console.error('Retry error:', error);
                window.showNotification('error', 'Failed to trigger reconnection.');
            }
        },

        async forceReset() {
            if (!confirm('This will wipe any cached WhatsApp Web pairing and generate a fresh QR code. Continue?')) return;
            await this.retry(true);
        },

        async fetchStatus() {
            try {
                const result = await this.$store.app.api('/whatsapp/status');

                if (result.success) {
                    this.status = result.data.status;
                    this.qrCode = result.data.qrCode;
                    this.loadingPercent = result.data.loadingPercent || 0;
                    this.loadingMessage = result.data.loadingMessage || '';

                    if (this.qrCode && this.qrCode !== this.lastQr) {
                        this.lastQr = this.qrCode;
                        this.renderQr(this.qrCode);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch WhatsApp status:', error);
            }
        },

        async fetchSales() {
            try {
                const result = await this.$store.app.api('/whatsapp/sales');
                if (result.success && result.data) {
                    this.metrics = result.data.metrics || this.metrics;
                    this.inquiries = result.data.inquiries || [];
                }
            } catch (error) {
                console.error('Failed to fetch WhatsApp sales/deals:', error);
            }
        },

        renderQr(data) {
            this.$nextTick(() => {
                const container = document.getElementById('qr-container');
                if (!container) return;

                const typeNumber = 0;
                const errorCorrectionLevel = 'H';
                const qr = qrcode(typeNumber, errorCorrectionLevel);
                qr.addData(data);
                qr.make();
                
                container.innerHTML = qr.createImgTag(6);
                const img = container.querySelector('img');
                if (img) {
                    img.classList.add('w-56', 'h-56', 'mx-auto', 'rounded-lg');
                }
            });
        },

        openInquiryModal(inq) {
            this.selectedInquiry = inq;
        },

        closeInquiryModal() {
            this.selectedInquiry = null;
        },

        formatCurrency(num) {
            return '₹' + Number(num || 0).toLocaleString('en-IN');
        },

        formatDate(dateStr) {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        },

        formatCustomerPhone(inq) {
            if (!inq) return '—';
            const phone = inq.customerRealPhone || (!inq.customerPhone?.includes('@lid') ? inq.customerPhone : '');
            if (phone) {
                const digits = phone.replace(/\D/g, '');
                if (digits.startsWith('91')) {
                    const local = digits.slice(2);
                    return local.length === 10 ? `+91 ${local.slice(0, 5)} ${local.slice(5)}` : `+91 ${local}`;
                } else if (digits === '923167255624') {
                    return `+91 923167255624`;
                } else if (digits.startsWith('92') && digits.length === 12) {
                    return `+92 ${digits.slice(2, 5)} ${digits.slice(5)}`;
                } else if (digits.length === 10) {
                    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
                }
                return `+${digits}`;
            }
            return 'WhatsApp Direct';
        },

        async logout() {
            if (!confirm('Are you sure you want to disconnect WhatsApp? This will stop automated notifications.')) return;
            
            try {
                const result = await this.$store.app.api('/whatsapp/logout', 'POST');
                if (result.success) {
                    window.showNotification('success', 'WhatsApp disconnected successfully.');
                    this.status = 'DISCONNECTED';
                    this.qrCode = null;
                    this.loadingPercent = 0;
                    this.loadingMessage = '';
                } else {
                    window.showNotification('error', 'Failed to disconnect WhatsApp.');
                }
            } catch (error) {
                console.error('Logout error:', error);
                window.showNotification('error', 'An error occurred while disconnecting WhatsApp.');
            }
        },

        cleanup() {
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
            }
        }
    }));
});
