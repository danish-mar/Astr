function invoiceViewData() {
    return {
        invoiceId: '',
        invoice: null,
        shop: null,
        accounts: [],
        loading: true,

        paymentModal: {
            show: false,
            amount: 0,
            paymentMode: 'Cash',
            accountId: '',
            reference: '',
            submitting: false,
        },

        async init() {
            // Extract invoice ID from pathname (/invoices/:id)
            const parts = window.location.pathname.split('/');
            this.invoiceId = parts[parts.length - 1];

            await Promise.all([
                this.fetchInvoice(),
                this.fetchAccounts()
            ]);
        },

        async fetchInvoice() {
            this.loading = true;
            try {
                const res = await Alpine.store('app').api(`/invoices/${this.invoiceId}`);
                if (res.success && res.data) {
                    this.invoice = res.data.invoice;
                    this.shop = res.data.shop;
                    this.paymentModal.amount = this.invoice.balanceDue || 0;
                    document.title = `${this.invoice.customerName || 'Customer'} - ${this.invoice.docNumber || 'Document'}`;
                }
            } catch (err) {
                console.error('Fetch invoice error:', err);
                window.showNotification('Failed to load invoice details', 'error');
            } finally {
                this.loading = false;
            }
        },

        async fetchAccounts() {
            try {
                const res = await Alpine.store('app').api('/accounting/accounts');
                if (res.success && res.data) {
                    this.accounts = res.data;
                    if (this.accounts.length > 0) {
                        this.paymentModal.accountId = this.accounts[0]._id;
                    }
                }
            } catch (err) {
                console.error('Fetch accounts error:', err);
            }
        },

        printInvoice() {
            window.open(`/invoices/${this.invoiceId}/print?autoprint=1`, '_blank');
        },

        shareWhatsApp() {
            if (!this.invoice) return;
            const phone = this.invoice.customerPhone || '';
            const cleanPhone = phone.replace(/\D/g, '');

            const total = this.formatNumber(this.invoice.grandTotal);
            const balance = this.formatNumber(this.invoice.balanceDue);
            const docName = this.invoice.docType === 'Invoice' ? 'Tax Invoice' : 'Quotation';

            const text = `Hello ${this.invoice.customerName},\n\nHere is your ${docName} #${this.invoice.docNumber} from ${this.shop?.shopName || 'Astr Store'}.\n\nTotal Amount: ₹${total}\nBalance Due: ₹${balance}\n\nThank you for choosing us!`;

            const encoded = encodeURIComponent(text);
            const url = cleanPhone
                ? `https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encoded}`
                : `https://api.whatsapp.com/send?text=${encoded}`;

            window.open(url, '_blank');
        },

        async convertQuotation() {
            window.showConfirm(
                'Convert to Invoice',
                'Do you want to convert this quotation into an active Tax Invoice?',
                async () => {
                    try {
                        const res = await Alpine.store('app').api(`/invoices/${this.invoiceId}/convert`, 'POST');
                        if (res.success && res.data?.invoice) {
                            window.showNotification('Converted to Tax Invoice!', 'success');
                            window.location.href = `/invoices/${res.data.invoice._id}`;
                        }
                    } catch (err) {
                        console.error('Conversion error:', err);
                        window.showNotification(err.response?.data?.message || 'Conversion failed', 'error');
                    }
                }
            );
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
                    `/invoices/${this.invoiceId}/payments`,
                    'POST',
                    payload
                );

                if (res.success) {
                    window.showNotification('Payment recorded successfully', 'success');
                    this.paymentModal.show = false;
                    await this.fetchInvoice();
                }
            } catch (err) {
                console.error('Payment error:', err);
                window.showNotification(err.response?.data?.message || 'Payment recording failed', 'error');
            } finally {
                this.paymentModal.submitting = false;
            }
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
