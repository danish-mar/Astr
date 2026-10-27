document.addEventListener('alpine:init', () => {
    Alpine.data('settingsData', () => ({
        activeTab: 'general',
        settings: {
            shopName: '',
            themeColor: '#3B82F6',
            phone: '',
            email: '',
            address: '',
            instagramUsername: '',
            reviewUrl: 'https://g.page/r/your-google-review-link',
            reviewAccessKey: 'review123',
            aiProvider: 'none',
            aiCustomProviderName: '',
            aiBaseUrl: '',
            aiModel: '',
            aiApiKey: '',
            hasAiApiKey: false,
            aiEnabled: false,
            // GST & Billing
            gstin: '',
            state: '',
            stateCode: '',
            defaultGstRate: 18,
            invoicePrefix: 'INV-',
            invoiceNextNumber: 1001,
            quotationPrefix: 'QTN-',
            quotationNextNumber: 1001,
            bankName: '',
            bankAccountNumber: '',
            bankIfsc: '',
            bankBranch: '',
            upiId: '',
            invoiceTerms: '',
            // WhatsApp Agent
            whatsappAgentEnabled: true,
            bossPhone: '',
            defaultMarginPercent: 20
        },
        saving: false,
        showApiKey: false,
        testingConnection: false,
        connectionTestResult: false,
        connectionTestSuccess: false,
        connectionTestMessage: '',
        fetchingModels: false,
        modelsList: [],
        fetchModelsMessage: '',
        showModelDropdown: false,
        qrDataUrl: '',
        qrTargetUrl: '',
        loadingQr: false,
        copiedReviewLink: false,
        copiedInstagramLink: false,

        get filteredModels() {
            if (!this.modelsList || this.modelsList.length === 0) return [];
            if (!this.settings.aiModel) return this.modelsList;
            const q = this.settings.aiModel.toLowerCase().trim();
            const filtered = this.modelsList.filter(m => m.toLowerCase().includes(q));
            return filtered.length > 0 ? filtered : this.modelsList;
        },

        selectModel(modelName) {
            this.settings.aiModel = modelName;
            this.showModelDropdown = false;
        },

        toggleModelDropdown() {
            if (this.modelsList.length === 0 && !this.fetchingModels) {
                this.fetchModels();
            } else {
                this.showModelDropdown = !this.showModelDropdown;
            }
        },

        async init() {
            try {
                const response = await window.api.get('/settings');
                if (response.success && response.data.settings) {
                    this.settings = { ...this.settings, ...response.data.settings };
                    // If a model is already configured or provider is selected, we can optionally pre-populate
                    if (this.settings.aiModel) {
                        this.modelsList = [this.settings.aiModel];
                    }
                }
                await this.fetchReviewQr();
            } catch (error) {
                console.error('Failed to load settings:', error);
                window.showNotification('error', 'Failed to load settings');
            }
        },

        async saveSettings() {
            this.saving = true;
            try {
                const payload = { ...this.settings };
                const response = await window.api.put('/settings', payload);
                if (response.success) {
                    if (response.data.settings) {
                        this.settings = { ...this.settings, ...response.data.settings };
                    }
                    if (payload.aiApiKey && payload.aiApiKey.trim() !== '') {
                        this.settings.hasAiApiKey = true;
                    }
                    this.settings.aiApiKey = '';
                    window.showNotification('success', 'Settings updated successfully');
                    await this.fetchReviewQr();

                    // Update global shop name if it's displayed elsewhere
                    if (this.settings.shopName) {
                        document.querySelectorAll('.shop-name-display').forEach(el => {
                            el.textContent = this.settings.shopName;
                        });
                    }
                }
            } catch (error) {
                console.error('Failed to save settings:', error);
                window.showNotification('error', error.response?.data?.message || 'Failed to save settings');
            } finally {
                this.saving = false;
            }
        },

        async fetchReviewQr() {
            this.loadingQr = true;
            try {
                const response = await window.api.get('/reviews/qr');
                if (response.success && response.data) {
                    this.qrDataUrl = response.data.qrDataUrl;
                    this.qrTargetUrl = response.data.targetUrl;
                }
            } catch (err) {
                console.warn('Failed to fetch review QR:', err);
            } finally {
                this.loadingQr = false;
            }
        },

        getReviewDirectLink() {
            const origin = window.location.origin;
            const key = (this.settings.reviewAccessKey || 'review123').trim();
            return `${origin}/reviews?key=${encodeURIComponent(key)}`;
        },

        getInstagramRedirectLink() {
            const origin = window.location.origin;
            return `${origin}/instagram`;
        },

        async copyReviewLink() {
            try {
                const url = this.getReviewDirectLink();
                await navigator.clipboard.writeText(url);
                this.copiedReviewLink = true;
                window.showNotification('success', 'Review page link copied to clipboard!');
                setTimeout(() => {
                    this.copiedReviewLink = false;
                }, 3000);
            } catch (err) {
                console.error('Copy failed:', err);
                window.showNotification('error', 'Failed to copy link');
            }
        },

        async copyInstagramLink() {
            try {
                const url = this.getInstagramRedirectLink();
                await navigator.clipboard.writeText(url);
                this.copiedInstagramLink = true;
                window.showNotification('success', 'Instagram redirect link copied to clipboard!');
                setTimeout(() => {
                    this.copiedInstagramLink = false;
                }, 3000);
            } catch (err) {
                console.error('Copy failed:', err);
                window.showNotification('error', 'Failed to copy link');
            }
        },

        downloadQrCode() {
            if (!this.qrDataUrl) return;
            const link = document.createElement('a');
            link.href = this.qrDataUrl;
            link.download = `${(this.settings.shopName || 'shop').toLowerCase().replace(/\s+/g, '-')}-review-qr.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.showNotification('success', 'QR Code downloaded!');
        },

        printQrCode() {
            if (!this.qrDataUrl) return;
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                window.showNotification('error', 'Popup blocked. Please allow popups to print.');
                return;
            }

            const shop = this.settings.shopName || 'Astr Tech & Repairs';
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Review Standee - ${shop}</title>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            min-height: 100vh;
                            margin: 0;
                            background-color: #fff;
                            color: #0f172a;
                        }
                        .standee {
                            border: 3px solid #0f172a;
                            border-radius: 24px;
                            padding: 40px;
                            text-align: center;
                            max-width: 420px;
                            width: 100%;
                            box-sizing: border-box;
                        }
                        h1 { font-size: 26px; margin: 0 0 8px 0; font-weight: 800; }
                        p { font-size: 14px; color: #64748b; margin: 0 0 24px 0; }
                        .stars { color: #f59e0b; font-size: 24px; margin-bottom: 20px; }
                        img { width: 240px; height: 240px; margin: 0 auto; display: block; }
                        .badge {
                            display: inline-block;
                            margin-top: 24px;
                            padding: 8px 20px;
                            background: #0f172a;
                            color: #fff;
                            border-radius: 100px;
                            font-weight: 700;
                            font-size: 13px;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                        }
                    </style>
                </head>
                <body>
                    <div class="standee">
                        <h1>${shop}</h1>
                        <div class="stars">★★★★★</div>
                        <p>Scan with your phone camera to leave a quick 5-star review!</p>
                        <img src="${this.qrDataUrl}" alt="Scan to Review" />
                        <div class="badge">Scan & Review</div>
                    </div>
                    <script>
                        window.onload = function() { window.print(); window.close(); };
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        },

        async deleteUser(user) {
            // Logic removed - migrated to /team
        },

        async fetchModels() {
            if (this.settings.aiProvider === 'none') return;
            
            if (this.settings.aiProvider === 'custom' && !this.settings.aiBaseUrl) {
                window.showNotification('error', 'Please enter the OpenAI Endpoint URL first.');
                return;
            }

            this.fetchingModels = true;
            this.fetchModelsMessage = '';

            try {
                const response = await window.api.post('/ai/models', {
                    provider: this.settings.aiProvider,
                    baseUrl: this.settings.aiBaseUrl,
                    apiKey: this.settings.aiApiKey
                });

                if (response.success && response.data.models) {
                    this.modelsList = response.data.models;
                    this.fetchModelsMessage = `Discovered ${this.modelsList.length} model(s)`;
                    this.showModelDropdown = true;
                    window.showNotification('success', `Fetched ${this.modelsList.length} models`);
                    
                    if (!this.settings.aiModel && this.modelsList.length > 0) {
                        this.settings.aiModel = this.modelsList[0];
                    }
                }
            } catch (error) {
                console.error('Failed to fetch models:', error);
                const msg = error.response?.data?.message || error.message || 'Failed to fetch models';
                this.fetchModelsMessage = msg;
                window.showNotification('error', msg);
            } finally {
                this.fetchingModels = false;
            }
        },

        async testAIConnection() {
            this.testingConnection = true;
            this.connectionTestResult = false;
            try {
                const response = await window.api.post('/ai/test-connection', {
                    provider: this.settings.aiProvider,
                    baseUrl: this.settings.aiBaseUrl,
                    apiKey: this.settings.aiApiKey,
                    model: this.settings.aiModel
                });
                this.connectionTestSuccess = true;
                this.connectionTestMessage = response.message || 'Connection successful!';
                this.connectionTestResult = true;
            } catch (error) {
                this.connectionTestSuccess = false;
                this.connectionTestMessage = error.response?.data?.message || error.message || 'Connection failed. Please check your settings.';
                this.connectionTestResult = true;
            } finally {
                this.testingConnection = false;
            }
        }
    }));
});


