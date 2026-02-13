document.addEventListener('alpine:init', () => {
    Alpine.data('whatsappLink', () => ({
        status: 'INITIALIZING', // INITIALIZING, AUTHENTICATED, READY, DISCONNECTED
        qrCode: null,
        pollingInterval: null,
        lastQr: null,

        get statusText() {
            switch (this.status) {
                case 'READY': return 'Registry Active';
                case 'AUTHENTICATED': return 'Validating session...';
                case 'INITIALIZING': return this.qrCode ? 'Awaiting Scan' : 'Warming up...';
                case 'DISCONNECTED': return 'Disconnected';
                default: return 'Initializing...';
            }
        },

        async init() {
            this.fetchStatus();
            // Poll every 3 seconds for status updates
            this.pollingInterval = setInterval(() => this.fetchStatus(), 3000);
        },

        async retry() {
            this.status = 'INITIALIZING';
            this.qrCode = null;
            try {
                await this.$store.app.api('/whatsapp/initialize', 'POST');
                window.showNotification('info', 'Retrying connection...');
                this.fetchStatus();
            } catch (error) {
                console.error('Retry error:', error);
                window.showNotification('error', 'Failed to trigger reconnection.');
            }
        },

        async fetchStatus() {
            try {
                // Use the global api helper from Alpine store
                const result = await this.$store.app.api('/whatsapp/status');

                if (result.success) {
                    this.status = result.data.status;
                    this.qrCode = result.data.qrCode;

                    if (this.qrCode && this.qrCode !== this.lastQr) {
                        this.lastQr = this.qrCode;
                        this.renderQr(this.qrCode);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch WhatsApp status:', error);
            }
        },

        renderQr(data) {
            this.$nextTick(() => {
                const container = document.getElementById('qr-container');
                if (!container) return;

                // Use qrcode-generator
                const typeNumber = 0;
                const errorCorrectionLevel = 'H';
                const qr = qrcode(typeNumber, errorCorrectionLevel);
                qr.addData(data);
                qr.make();
                
                container.innerHTML = qr.createImgTag(6);
                const img = container.querySelector('img');
                if (img) {
                    img.classList.add('w-64', 'h-64', 'mx-auto');
                }
            });
        },

        async logout() {
            if (!confirm('Are you sure you want to disconnect WhatsApp? This will stop automated notifications.')) return;
            
            try {
                const result = await this.$store.app.api('/whatsapp/logout', 'POST');
                if (result.success) {
                    window.showNotification('success', 'WhatsApp disconnected successfully.');
                    this.status = 'DISCONNECTED';
                    this.qrCode = null;
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
