(function () {
    const initComponent = () => {
        Alpine.data('serviceTicketViewData', () => ({
            ticket: null,
            loading: true,
            ticketId: null,
            technicians: [],
            shopSettings: null,

            get token() { return window.api?.token; },
            get isSettled() {
                if (!this.ticket || !this.ticket.logs) return false;
                return this.ticket.logs.some(log => log.label && (log.label.includes('Payment confirmed') || log.label.includes('Settlement')));
            },

            async init() {
                if (!this.token) {
                    window.location.href = '/login';
                    return;
                }

                const pathParts = window.location.pathname.split('/');
                this.ticketId = pathParts[pathParts.length - 1];

                if (!this.ticketId || this.ticketId === 'service-tickets') {
                    window.location.href = '/service-tickets';
                    return;
                }

                await Promise.all([
                    this.loadTicket(),
                    this.loadTechnicians(),
                    this.loadShopSettings()
                ]);
            },

            async loadShopSettings() {
                try {
                    const response = await window.api.get('/settings');
                    if (response.data && response.data.settings) {
                        this.shopSettings = response.data.settings;
                    }
                } catch (e) {
                    // ignore
                }
            },

            async loadTechnicians() {
                try {
                    const response = await window.api.get('/employees?limit=100');
                    this.technicians = response.data || [];
                } catch (error) {
                    console.error('Error loading technicians:', error);
                }
            },

            getTechnicianName(tech) {
                if (!tech) return 'Awaiting Assignment';
                if (typeof tech === 'object') return tech.name || tech.username || 'Assigned Tech';
                const technician = this.technicians.find(t => t._id === tech || t.username === tech);
                return technician ? (technician.name || technician.username) : tech;
            },

            async loadTicket() {
                this.loading = true;
                try {
                    const response = await window.api.get(`/service-tickets/${this.ticketId}`);
                    this.ticket = response.data;
                } catch (error) {
                    console.error('Error loading ticket:', error);
                    window.showNotification?.('Error loading ticket details', 'error');
                } finally {
                    this.loading = false;
                }
            },

            async updateStatus(newStatus) {
                if (!this.ticket || this.ticket.status === newStatus) return;
                const prevStatus = this.ticket.status;
                // Optimistic update: instantly reflect in 0ms
                this.ticket.status = newStatus;

                try {
                    const response = await window.api.patch(`/service-tickets/${this.ticketId}/status`, { status: newStatus });
                    window.showNotification?.(`Status advanced to ${newStatus}`);
                    if (response.data?.logs) {
                        this.ticket.logs = response.data.logs;
                    }
                } catch (error) {
                    console.error('Error updating status:', error);
                    this.ticket.status = prevStatus;
                    window.showNotification?.('Failed to update status', 'error');
                }
            },

            copyTicketNumber(num) {
                if (!num) return;
                navigator.clipboard.writeText(num).then(() => {
                    window.showNotification?.(`Ticket #${num} copied`);
                });
            },

            openWhatsApp() {
                if (!this.ticket || !this.ticket.customer?.phone) {
                    window.showNotification?.('No phone available for WhatsApp', 'warning');
                    return;
                }
                const phone = String(this.ticket.customer.phone).replace(/[^0-9]/g, '');
                const cleanPhone = phone.length === 10 ? `91${phone}` : phone;
                const customerName = this.ticket.customer?.name || 'Customer';
                const model = this.getDeviceModel(this.ticket.deviceDetails);
                const status = this.ticket.status;
                const charge = this.ticket.serviceCharge ? `₹${Number(this.ticket.serviceCharge).toLocaleString('en-IN')}` : 'TBD';

                const text = encodeURIComponent(
                    `Hello ${customerName},\n\n` +
                    `Here is the latest service status for your device:\n` +
                    `• Ticket: #${this.ticket.ticketNumber}\n` +
                    `• Device: ${model}\n` +
                    `• Status: *${status}*\n` +
                    `• Estimate/Charge: ${charge}\n\n` +
                    `Thank you for trusting ${this.shopSettings?.shopName || 'our workshop'}.`
                );

                window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
            },

            getDeviceIcon(details) {
                if (!details) return 'fas fa-microchip';
                const lower = details.toLowerCase();
                if (/iphone|galaxy|pixel|oneplus|phone|mobile|redmi|oppo|vivo|realme/i.test(lower)) return 'fas fa-mobile-screen-button';
                if (/macbook|laptop|thinkpad|inspiron|notebook|zenbook|latitude/i.test(lower)) return 'fas fa-laptop';
                if (/ipad|tablet|tab /i.test(lower)) return 'fas fa-tablet-screen-button';
                if (/desktop|pc|tower|workstation|cabinet|imac/i.test(lower)) return 'fas fa-desktop';
                if (/watch|iwatch|smartwatch/i.test(lower)) return 'fas fa-clock';
                if (/printer|scanner/i.test(lower)) return 'fas fa-print';
                return 'fas fa-wrench';
            },

            getDeviceModel(details) {
                if (!details) return 'Hardware Device';
                const firstPart = details.split(/[,;\n-]/)[0].trim();
                return firstPart.length > 3 ? firstPart : details.slice(0, 30);
            },

            getDeviceCategory(details) {
                if (!details) return 'Hardware Device';
                const lower = details.toLowerCase();
                if (/iphone|galaxy|pixel|phone|mobile/i.test(lower)) return 'Smartphone';
                if (/macbook|laptop|thinkpad|notebook/i.test(lower)) return 'Laptop / Notebook';
                if (/desktop|pc|tower|imac/i.test(lower)) return 'Desktop PC';
                return 'Hardware Device';
            },

            getStageIndex(status) {
                switch (status) {
                    case 'Pending': return 1;
                    case 'In Progress': return 2;
                    case 'Completed': return 3;
                    case 'Delivered': return 4;
                    default: return 1;
                }
            },

            getStagePercent(status) {
                switch (status) {
                    case 'Pending': return 25;
                    case 'In Progress': return 50;
                    case 'Completed': return 85;
                    case 'Delivered': return 100;
                    default: return 20;
                }
            },

            formatDate(dateString) {
                if (!dateString) return '—';
                return new Date(dateString).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                });
            },

            formatDateTime(dateString) {
                if (!dateString) return '—';
                return new Date(dateString).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            },

            formatCurrency(val) {
                return Number(val || 0).toLocaleString('en-IN');
            },

            editTicket() {
                window.location.href = `/service-tickets?edit=${this.ticketId}`;
            },

            showOutsourceModal: false,
            savingOutsource: false,
            outsourceForm: {
                isOutsourced: false,
                partnerShopName: '',
                partnerContact: '',
                externalJobNumber: '',
                sentDate: '',
                expectedReturnDate: '',
                receivedDate: '',
                vendorCost: 0,
                custodyLocation: 'In-House',
                repairOutcome: 'Pending',
                notes: ''
            },

            openOutsourceModal() {
                const o = this.ticket?.outsourcedRepair || {};
                this.outsourceForm = {
                    isOutsourced: Boolean(o.isOutsourced),
                    partnerShopName: o.partnerShopName || '',
                    partnerContact: o.partnerContact || '',
                    externalJobNumber: o.externalJobNumber || '',
                    sentDate: o.sentDate ? new Date(o.sentDate).toISOString().split('T')[0] : (o.isOutsourced ? '' : new Date().toISOString().split('T')[0]),
                    expectedReturnDate: o.expectedReturnDate ? new Date(o.expectedReturnDate).toISOString().split('T')[0] : '',
                    receivedDate: o.receivedDate ? new Date(o.receivedDate).toISOString().split('T')[0] : '',
                    vendorCost: o.vendorCost || 0,
                    custodyLocation: o.custodyLocation || 'In-House',
                    repairOutcome: o.repairOutcome || 'Pending',
                    notes: o.notes || ''
                };
                if (!o.isOutsourced) {
                    this.outsourceForm.isOutsourced = true;
                    this.outsourceForm.custodyLocation = 'At Partner Shop';
                    this.outsourceForm.repairOutcome = 'In Progress';
                }
                this.showOutsourceModal = true;
            },

            async saveOutsourceTracking() {
                this.savingOutsource = true;
                const prevOutsourced = JSON.parse(JSON.stringify(this.ticket?.outsourcedRepair || {}));

                // Optimistic UI: update immediately in 0ms and close modal
                if (!this.ticket.outsourcedRepair) this.ticket.outsourcedRepair = {};
                Object.assign(this.ticket.outsourcedRepair, this.outsourceForm);
                this.showOutsourceModal = false;

                try {
                    const response = await window.api.put(`/service-tickets/${this.ticketId}`, {
                        outsourcedRepair: this.outsourceForm
                    });
                    if (response.success || response.data) {
                        window.showNotification?.('External workshop tracking updated');
                        const updated = response.data || {};
                        if (updated.outsourcedRepair) this.ticket.outsourcedRepair = updated.outsourcedRepair;
                        if (updated.logs) this.ticket.logs = updated.logs;
                    }
                } catch (error) {
                    console.error('Error updating outsourced repair:', error);
                    this.ticket.outsourcedRepair = prevOutsourced;
                    window.showNotification?.(error.response?.data?.message || 'Error updating outsourced repair', 'error');
                } finally {
                    this.savingOutsource = false;
                }
            },

            async quickSetCustody(newCustody) {
                if (!this.ticket) return;
                if (!this.ticket.outsourcedRepair) this.ticket.outsourcedRepair = { isOutsourced: true };

                const prevCustody = this.ticket.outsourcedRepair.custodyLocation || 'In-House';
                if (prevCustody === newCustody) return;

                // Optimistic UI: Update immediately in 0ms
                this.ticket.outsourcedRepair.isOutsourced = true;
                this.ticket.outsourcedRepair.custodyLocation = newCustody;
                if (newCustody === 'Received Back' && !this.ticket.outsourcedRepair.receivedDate) {
                    this.ticket.outsourcedRepair.receivedDate = new Date();
                }

                const o = { ...this.ticket.outsourcedRepair };

                try {
                    const response = await window.api.put(`/service-tickets/${this.ticketId}`, {
                        outsourcedRepair: o
                    });
                    if (response.success || response.data) {
                        window.showNotification?.(`Custody updated to: ${newCustody}`);
                        const updated = response.data || {};
                        if (updated.outsourcedRepair) this.ticket.outsourcedRepair = updated.outsourcedRepair;
                        if (updated.logs) this.ticket.logs = updated.logs;
                    }
                } catch (error) {
                    console.error('Error updating custody:', error);
                    this.ticket.outsourcedRepair.custodyLocation = prevCustody;
                    window.showNotification?.('Failed to update custody', 'error');
                }
            },

            async quickSetOutcome(newOutcome) {
                if (!this.ticket) return;
                if (!this.ticket.outsourcedRepair) this.ticket.outsourcedRepair = { isOutsourced: true };

                const prevOutcome = this.ticket.outsourcedRepair.repairOutcome || 'Pending';
                if (prevOutcome === newOutcome) return;

                // Optimistic UI: Update immediately in 0ms
                this.ticket.outsourcedRepair.isOutsourced = true;
                this.ticket.outsourcedRepair.repairOutcome = newOutcome;

                const o = { ...this.ticket.outsourcedRepair };

                try {
                    const response = await window.api.put(`/service-tickets/${this.ticketId}`, {
                        outsourcedRepair: o
                    });
                    if (response.success || response.data) {
                        const labels = {
                            'Repaired': 'Marked as Repaired by partner',
                            'Cant Repair': 'Marked as Can\'t Repair',
                            'Not Repaired': 'Marked as Not Repaired',
                            'In Progress': 'Marked as In Progress'
                        };
                        window.showNotification?.(labels[newOutcome] || `Outcome: ${newOutcome}`);
                        const updated = response.data || {};
                        if (updated.outsourcedRepair) this.ticket.outsourcedRepair = updated.outsourcedRepair;
                        if (updated.logs) this.ticket.logs = updated.logs;
                    }
                } catch (error) {
                    console.error('Error updating outcome:', error);
                    this.ticket.outsourcedRepair.repairOutcome = prevOutcome;
                    window.showNotification?.('Failed to update outcome', 'error');
                }
            },

            async settlePayment() {
                if (!confirm('Confirm payment for this ticket? This will record a payment in the customer ledger.')) return;

                try {
                    const response = await window.api.post(`/service-tickets/${this.ticketId}/settle-payment`);
                    if (response.success) {
                        window.showNotification?.('Payment settled successfully');
                        await this.loadTicket();
                    }
                } catch (error) {
                    console.error('Error settling payment:', error);
                    window.showNotification?.(error.response?.data?.message || 'Error settling payment', 'error');
                }
            }
        }));
    };

    if (window.Alpine) {
        initComponent();
    } else {
        document.addEventListener('alpine:init', initComponent);
    }
})();
