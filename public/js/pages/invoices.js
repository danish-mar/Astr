function invoicesData() {
    return {
        invoices: [],
        metrics: { sales: 0, collected: 0, due: 0, tax: 0, totalInvoices: 0, totalQuotations: 0, unpaidCount: 0 },
        accounts: [],
        loading: false,
        filterDocType: '',
        filterStatus: '',
        searchQuery: '',
        pagination: { page: 1, limit: 15, total: 0, totalPages: 1 },

        // Payment modal state
        paymentModal: {
            show: false,
            invoiceId: null,
            docNumber: '',
            balanceDue: 0,
            amount: 0,
            paymentMode: 'Cash',
            accountId: '',
            reference: '',
            submitting: false,
        },

        async init() {
            // Check query param
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('type')) {
                this.filterDocType = urlParams.get('type');
            }
            if (urlParams.get('status')) {
                this.filterStatus = urlParams.get('status');
            }

            await Promise.all([
                this.fetchInvoices(),
                this.fetchMetrics(),
                this.fetchAccounts()
            ]);
        },

        async fetchInvoices() {
            this.loading = true;
            try {
                let url = `/invoices?page=${this.pagination.page}&limit=${this.pagination.limit}`;
                if (this.filterDocType) url += `&docType=${encodeURIComponent(this.filterDocType)}`;
                if (this.filterStatus) url += `&status=${encodeURIComponent(this.filterStatus)}`;
                if (this.searchQuery) url += `&search=${encodeURIComponent(this.searchQuery)}`;

                const res = await Alpine.store('app').api(url);
                if (res.success) {
                    this.invoices = res.data || [];
                    if (res.pagination) {
                        this.pagination = res.pagination;
                    }
                }
            } catch (error) {
                console.error('Failed to fetch invoices:', error);
                window.showNotification('Failed to load documents', 'error');
            } finally {
                this.loading = false;
            }
        },

        async fetchMetrics() {
            try {
                const res = await Alpine.store('app').api('/invoices/metrics');
                if (res.success && res.data) {
                    this.metrics = res.data;
                }
            } catch (err) {
                console.error('Failed to load metrics:', err);
            }
        },

        async fetchAccounts() {
            try {
                const res = await Alpine.store('app').api('/accounting/accounts');
                if (res.success && res.data) {
                    this.accounts = res.data;
                }
            } catch (err) {
                console.error('Failed to load accounts:', err);
            }
        },

        setDocType(type) {
            this.filterDocType = type;
            this.filterStatus = '';
            this.pagination.page = 1;
            this.fetchInvoices();
        },

        setStatus(status) {
            this.filterStatus = status;
            this.pagination.page = 1;
            this.fetchInvoices();
        },

        prevPage() {
            if (this.pagination.page > 1) {
                this.pagination.page--;
                this.fetchInvoices();
            }
        },

        nextPage() {
            if (this.pagination.page < this.pagination.totalPages) {
                this.pagination.page++;
                this.fetchInvoices();
            }
        },

        openPaymentModal(inv) {
            this.paymentModal.invoiceId = inv._id;
            this.paymentModal.docNumber = inv.docNumber;
            this.paymentModal.balanceDue = inv.balanceDue;
            this.paymentModal.amount = inv.balanceDue;
            this.paymentModal.paymentMode = 'Cash';
            this.paymentModal.accountId = this.accounts[0]?._id || '';
            this.paymentModal.reference = '';
            this.paymentModal.submitting = false;
            this.paymentModal.show = true;
        },

        async submitPayment() {
            if (this.paymentModal.amount <= 0) {
                window.showNotification('Payment amount must be greater than zero', 'error');
                return;
            }

            this.paymentModal.submitting = true;
            try {
                const payload = {
                    amount: this.paymentModal.amount,
                    paymentMode: this.paymentModal.paymentMode,
                    accountId: this.paymentModal.accountId || undefined,
                    reference: this.paymentModal.reference,
                };

                const res = await Alpine.store('app').api(
                    `/invoices/${this.paymentModal.invoiceId}/payments`,
                    'POST',
                    payload
                );

                if (res.success) {
                    window.showNotification('Payment recorded successfully', 'success');
                    this.paymentModal.show = false;
                    await Promise.all([this.fetchInvoices(), this.fetchMetrics()]);
                }
            } catch (err) {
                console.error('Payment error:', err);
                window.showNotification(err.response?.data?.message || 'Payment recording failed', 'error');
            } finally {
                this.paymentModal.submitting = false;
            }
        },

        async convertQuotation(id) {
            window.showConfirm(
                'Convert to Invoice',
                'Do you want to convert this quotation into an active Tax Invoice?',
                async () => {
                    try {
                        const res = await Alpine.store('app').api(`/invoices/${id}/convert`, 'POST');
                        if (res.success && res.data?.invoice) {
                            window.showNotification('Quotation converted to Invoice!', 'success');
                            window.location.href = `/invoices/${res.data.invoice._id}`;
                        }
                    } catch (err) {
                        console.error('Conversion error:', err);
                        window.showNotification(err.response?.data?.message || 'Failed to convert quotation', 'error');
                    }
                }
            );
        },

        async deleteDoc(inv) {
            window.showConfirm(
                `Delete ${inv.docType}`,
                `Are you sure you want to permanently delete document ${inv.docNumber}?`,
                async () => {
                    try {
                        const res = await Alpine.store('app').api(`/invoices/${inv._id}`, 'DELETE');
                        if (res.success) {
                            window.showNotification(`${inv.docType} deleted`, 'success');
                            await Promise.all([this.fetchInvoices(), this.fetchMetrics()]);
                        }
                    } catch (err) {
                        console.error('Delete error:', err);
                        window.showNotification(err.response?.data?.message || 'Failed to delete document', 'error');
                    }
                }
            );
        },

        formatNumber(val) {
            return Number(val || 0).toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
        },

        formatDate(dateStr) {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            return d.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
            });
        },
    };
}
