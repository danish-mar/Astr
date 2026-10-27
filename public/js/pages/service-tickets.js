(function () {
    const initComponent = () => {
        Alpine.data('serviceTicketsData', () => ({
            tickets: [],
            customers: [],
            technicians: [],
            shopSettings: null,
            loading: true,
            statsLoading: false,

            // Metrics / KPIs
            metrics: {
                total: 0,
                pending: 0,
                inProgress: 0,
                completed: 0,
                delivered: 0,
                cancelled: 0,
                totalRevenue: 0
            },

            // Filter & Search Controls
            filters: {
                search: '',
                status: 'All',
                technician: '',
                sortBy: 'newest'
            },

            pagination: {
                page: 1,
                limit: 12,
                total: 0
            },

            viewMode: 'grid', // 'grid' or 'list'

            // Drawer State (Device Details Slide-over)
            showDrawer: false,
            selectedTicket: null,
            drawerLoading: false,

            // Print Tag Modal
            showPrintModal: false,
            printTicketData: null,

            // Create / Edit Modal State
            showModal: false,
            editMode: false,
            saving: false,
            formData: {
                _id: '',
                ticketNumber: '',
                customer: '',
                deviceDetails: '',
                status: 'Pending',
                assignedTechnician: '',
                serviceCharge: 0,
                notes: '',
                receivedDate: new Date().toISOString().split('T')[0]
            },

            // Quick Add Customer inside Modal
            showQuickAddCustomer: false,
            quickCustomer: {
                name: '',
                phone: '',
                companyName: ''
            },

            // Customer Autocomplete Search
            searchResults: [],
            isSearching: false,
            selectedCustomer: null,

            get token() { return window.api?.token; },
            get user() { return window.api?.user; },

            async init() {
                if (!this.token) {
                    window.location.href = '/login';
                    return;
                }

                await Promise.all([
                    this.loadStats(),
                    this.loadTickets(),
                    this.loadCustomers(),
                    this.loadTechnicians(),
                    this.loadShopSettings()
                ]);

                // Check for URL query params: ?ticket=ID or ?edit=ID
                const urlParams = new URLSearchParams(window.location.search);
                const viewId = urlParams.get('ticket');
                const editId = urlParams.get('edit');

                if (viewId) {
                    this.inspectById(viewId);
                } else if (editId) {
                    this.editById(editId);
                }
            },

            async loadStats() {
                this.statsLoading = true;
                try {
                    const response = await window.api.get('/service-tickets/stats');
                    if (response && response.data) {
                        const byStatus = response.data.byStatus || {};
                        this.metrics = {
                            total: response.data.total || 0,
                            pending: byStatus['Pending'] || 0,
                            inProgress: byStatus['In Progress'] || 0,
                            completed: byStatus['Completed'] || 0,
                            delivered: byStatus['Delivered'] || 0,
                            cancelled: byStatus['Cancelled'] || 0,
                            totalRevenue: response.data.totalRevenue || 0
                        };
                    }
                } catch (error) {
                    console.error('Error loading ticket stats:', error);
                } finally {
                    this.statsLoading = false;
                }
            },

            async loadTickets() {
                this.loading = true;
                try {
                    let query = `?page=${this.pagination.page}&limit=${this.pagination.limit}`;
                    if (this.filters.search) query += `&search=${encodeURIComponent(this.filters.search.trim())}`;
                    if (this.filters.status && this.filters.status !== 'All') query += `&status=${encodeURIComponent(this.filters.status)}`;
                    if (this.filters.technician) query += `&technician=${encodeURIComponent(this.filters.technician)}`;

                    const response = await window.api.get(`/service-tickets${query}`);
                    let ticketList = response.data || [];

                    // Apply client-side sorting if needed
                    if (this.filters.sortBy === 'oldest') {
                        ticketList.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                    } else if (this.filters.sortBy === 'chargeHigh') {
                        ticketList.sort((a, b) => (b.serviceCharge || 0) - (a.serviceCharge || 0));
                    } else if (this.filters.sortBy === 'chargeLow') {
                        ticketList.sort((a, b) => (a.serviceCharge || 0) - (b.serviceCharge || 0));
                    }

                    this.tickets = ticketList;
                    if (response.pagination) {
                        this.pagination = response.pagination;
                    }
                } catch (error) {
                    console.error('Error loading tickets:', error);
                    window.showNotification?.('Failed to load tickets', 'error');
                } finally {
                    this.loading = false;
                }
            },

            async loadCustomers() {
                try {
                    const response = await window.api.get('/contacts?limit=1000');
                    if (response.data && Array.isArray(response.data)) {
                        this.customers = response.data.filter(c => c.contactType === 'Customer');
                    }
                } catch (error) {
                    console.error('Error loading customers:', error);
                }
            },

            async loadTechnicians() {
                try {
                    const response = await window.api.get('/employees?limit=100');
                    if (response.data && Array.isArray(response.data)) {
                        this.technicians = response.data;
                    }
                } catch (error) {
                    console.error('Error loading technicians:', error);
                }
            },

            async loadShopSettings() {
                try {
                    const response = await window.api.get('/settings');
                    if (response.data && response.data.settings) {
                        this.shopSettings = response.data.settings;
                    }
                } catch (error) {
                    console.warn('Shop settings not available:', error);
                }
            },

            changePage(page) {
                if (page < 1 || (this.pagination.limit && page > Math.ceil(this.pagination.total / this.pagination.limit))) return;
                this.pagination.page = page;
                this.loadTickets();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            },

            viewTicket(ticket) {
                if (!ticket) return;
                const id = ticket._id || ticket;
                window.location.href = `/service-tickets/${id}`;
            },

            inspectDevice(ticket) {
                this.viewTicket(ticket);
            },

            inspectById(id) {
                if (id) {
                    window.location.href = `/service-tickets/${id}`;
                }
            },

            closeDrawer() {
                this.showDrawer = false;
            },

            // Quick Status Transition
            async updateStatus(ticketId, newStatus) {
                try {
                    const response = await window.api.patch(`/service-tickets/${ticketId}/status`, { status: newStatus });
                    window.showNotification?.(`Status updated to ${newStatus}`);

                    // Update locally
                    const updated = response.data || {};
                    const idx = this.tickets.findIndex(t => t._id === ticketId);
                    if (idx !== -1) {
                        this.tickets[idx].status = newStatus;
                        if (updated.logs) this.tickets[idx].logs = updated.logs;
                    }

                    if (this.selectedTicket && this.selectedTicket._id === ticketId) {
                        this.selectedTicket.status = newStatus;
                        if (updated.logs) this.selectedTicket.logs = updated.logs;
                    }

                    // Refresh stats
                    this.loadStats();
                } catch (error) {
                    console.error('Error updating status:', error);
                    window.showNotification?.('Failed to update status: ' + (error.response?.data?.message || error.message), 'error');
                }
            },

            // Settle Payment
            async settlePayment(ticketId) {
                if (!confirm('Confirm payment settlement for this repair ticket in the customer ledger?')) return;
                try {
                    const response = await window.api.post(`/service-tickets/${ticketId}/settle-payment`);
                    window.showNotification?.('Payment settled and recorded in ledger');

                    if (this.selectedTicket && this.selectedTicket._id === ticketId) {
                        await this.inspectDevice(this.selectedTicket);
                    }
                    this.loadTickets();
                    this.loadStats();
                } catch (error) {
                    console.error('Error settling payment:', error);
                    window.showNotification?.(error.response?.data?.message || 'Error settling payment', 'error');
                }
            },

            // Delete Ticket
            async deleteTicket(ticket) {
                if (!ticket) return;
                const confirmMsg = `Are you sure you want to delete ticket #${ticket.ticketNumber} (${this.getDeviceModel(ticket.deviceDetails)})?`;
                if (!confirm(confirmMsg)) return;

                try {
                    await window.api.delete(`/service-tickets/${ticket._id}`);
                    window.showNotification?.(`Ticket #${ticket.ticketNumber} deleted`);
                    if (this.showDrawer && this.selectedTicket?._id === ticket._id) {
                        this.closeDrawer();
                    }
                    this.loadTickets();
                    this.loadStats();
                } catch (error) {
                    console.error('Error deleting ticket:', error);
                    window.showNotification?.('Failed to delete ticket: ' + (error.response?.data?.message || error.message), 'error');
                }
            },

            // Copy Ticket Number
            copyTicketNumber(num) {
                if (!num) return;
                navigator.clipboard.writeText(num).then(() => {
                    window.showNotification?.(`Ticket #${num} copied to clipboard`);
                }).catch(() => {
                    window.showNotification?.(`Ticket #${num}`);
                });
            },

            // WhatsApp Message Trigger
            openWhatsApp(ticket) {
                if (!ticket || !ticket.customer?.phone) {
                    window.showNotification?.('No customer phone number available', 'warning');
                    return;
                }
                const phone = String(ticket.customer.phone).replace(/[^0-9]/g, '');
                const cleanPhone = phone.length === 10 ? `91${phone}` : phone;
                const customerName = ticket.customer?.name || 'Customer';
                const model = this.getDeviceModel(ticket.deviceDetails);
                const status = ticket.status;
                const charge = ticket.serviceCharge ? `₹${Number(ticket.serviceCharge).toLocaleString('en-IN')}` : 'TBD';

                const text = encodeURIComponent(
                    `Hello ${customerName},\n\n` +
                    `Here is the latest service status for your device:\n` +
                    `• Ticket: #${ticket.ticketNumber}\n` +
                    `• Device: ${model}\n` +
                    `• Status: *${status}*\n` +
                    `• Estimate/Charge: ${charge}\n\n` +
                    `Thank you for trusting ${this.shopSettings?.shopName || 'our workshop'}. Feel free to reply if you have any questions!`
                );

                window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
            },

            // Print Job Tag / Intake Slip
            openPrintModal(ticket) {
                this.printTicketData = ticket;
                this.showPrintModal = true;
            },

            printJobSlip() {
                window.print();
            },

            // --- MODAL (CREATE / EDIT) ---
            openAddModal() {
                this.editMode = false;
                this.formData = {
                    _id: '',
                    ticketNumber: '',
                    customer: '',
                    deviceDetails: '',
                    status: 'Pending',
                    assignedTechnician: '',
                    serviceCharge: 0,
                    notes: '',
                    receivedDate: new Date().toISOString().split('T')[0]
                };
                this.selectedCustomer = null;
                this.searchResults = [];
                this.showModal = true;
            },

            editTicket(ticket) {
                this.editMode = true;
                this.formData = {
                    _id: ticket._id,
                    ticketNumber: ticket.ticketNumber,
                    customer: ticket.customer?._id || ticket.customer,
                    deviceDetails: ticket.deviceDetails,
                    status: ticket.status,
                    assignedTechnician: ticket.assignedTechnician || '',
                    serviceCharge: ticket.serviceCharge || 0,
                    notes: ticket.notes || '',
                    receivedDate: ticket.receivedDate 
                        ? new Date(ticket.receivedDate).toISOString().split('T')[0] 
                        : (ticket.createdAt ? new Date(ticket.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
                };

                this.selectedCustomer = typeof ticket.customer === 'object' ? ticket.customer : null;
                this.showModal = true;
            },

            async editById(id) {
                try {
                    const response = await window.api.get(`/service-tickets/${id}`);
                    if (response && response.data) {
                        this.editTicket(response.data);
                    }
                } catch (err) {
                    console.error('Failed to edit ticket by ID', err);
                }
            },

            closeModal() {
                this.showModal = false;
                this.showQuickAddCustomer = false;
                this.selectedCustomer = null;
                this.searchResults = [];
            },

            async saveTicket() {
                if (!this.formData.customer || !this.formData.deviceDetails) {
                    window.showNotification?.('Please select a customer and provide device details', 'error');
                    return;
                }

                if (this.formData.deviceDetails.trim().length < 5) {
                    window.showNotification?.('Device details must be at least 5 characters long', 'error');
                    return;
                }

                this.saving = true;
                try {
                    if (this.editMode) {
                        const response = await window.api.put(`/service-tickets/${this.formData._id}`, this.formData);
                        window.showNotification?.('Service ticket updated successfully');
                        if (this.selectedTicket && this.selectedTicket._id === this.formData._id) {
                            this.selectedTicket = response.data;
                        }
                    } else {
                        const response = await window.api.post('/service-tickets', this.formData);
                        window.showNotification?.(`Ticket #${response.data?.ticketNumber || ''} created successfully`);
                    }
                    this.closeModal();
                    this.loadTickets();
                    this.loadStats();
                } catch (error) {
                    console.error('Save ticket error:', error);
                    window.showNotification?.('Error saving ticket: ' + (error.response?.data?.message || error.message), 'error');
                } finally {
                    this.saving = false;
                }
            },

            // Quick customer add inside modal
            async saveQuickCustomer() {
                if (!this.quickCustomer.name || !this.quickCustomer.phone) {
                    window.showNotification?.('Please enter customer name and phone', 'error');
                    return;
                }

                try {
                    const payload = {
                        ...this.quickCustomer,
                        contactType: 'Customer'
                    };
                    const response = await window.api.post('/contacts', payload);
                    const newCust = response.data;
                    this.customers.push(newCust);
                    this.selectedCustomer = newCust;
                    this.formData.customer = newCust._id;
                    this.showQuickAddCustomer = false;
                    this.quickCustomer = { name: '', phone: '', companyName: '' };
                    window.showNotification?.('New customer registered');
                } catch (error) {
                    console.error('Error creating customer:', error);
                    window.showNotification?.('Error adding customer: ' + (error.response?.data?.message || error.message), 'error');
                }
            },

            async searchContactsInModal(query) {
                if (!query || query.length < 2) {
                    this.searchResults = [];
                    return;
                }

                this.isSearching = true;
                try {
                    const response = await window.api.get(`/contacts?search=${encodeURIComponent(query)}&limit=6`);
                    if (response.data) {
                        this.searchResults = response.data.filter(c => c.contactType === 'Customer');
                    }
                } catch (error) {
                    console.error('Error searching contacts:', error);
                } finally {
                    this.isSearching = false;
                }
            },

            selectCustomerInModal(contact) {
                this.selectedCustomer = contact;
                this.formData.customer = contact._id;
                this.searchResults = [];
            },

            clearCustomerSelection() {
                this.selectedCustomer = null;
                this.formData.customer = '';
            },

            // --- PRESENTATION HELPERS ---
            getDeviceIcon(details) {
                if (!details) return 'fas fa-microchip';
                const lower = details.toLowerCase();
                if (/iphone|galaxy|pixel|oneplus|phone|mobile|redmi|oppo|vivo|realme|iqoo/i.test(lower)) {
                    return 'fas fa-mobile-screen-button';
                }
                if (/macbook|laptop|thinkpad|inspiron|pavilion|notebook|zenbook|rog|ideapad|latitude|surface laptop/i.test(lower)) {
                    return 'fas fa-laptop';
                }
                if (/ipad|tablet|tab /i.test(lower)) {
                    return 'fas fa-tablet-screen-button';
                }
                if (/desktop|pc|tower|workstation|cabinet|cpu|imac|rig/i.test(lower)) {
                    return 'fas fa-desktop';
                }
                if (/watch|iwatch|smartwatch/i.test(lower)) {
                    return 'fas fa-clock';
                }
                if (/printer|scanner|epson|canon|hp laser/i.test(lower)) {
                    return 'fas fa-print';
                }
                if (/audio|headphone|earphone|airpods|speaker|mic/i.test(lower)) {
                    return 'fas fa-headphones';
                }
                if (/motherboard|gpu|graphic card|psu|ram|hard drive|ssd/i.test(lower)) {
                    return 'fas fa-memory';
                }
                return 'fas fa-wrench';
            },

            getDeviceCategory(details) {
                if (!details) return 'Hardware Device';
                const lower = details.toLowerCase();
                if (/iphone|galaxy|pixel|oneplus|phone|mobile|redmi|oppo|vivo|realme/i.test(lower)) return 'Smartphone';
                if (/macbook|laptop|thinkpad|inspiron|notebook|zenbook|latitude/i.test(lower)) return 'Laptop / Notebook';
                if (/ipad|tablet|tab /i.test(lower)) return 'Tablet';
                if (/desktop|pc|tower|workstation|cabinet|imac/i.test(lower)) return 'Desktop PC';
                if (/printer|scanner/i.test(lower)) return 'Printer / Peripheral';
                return 'Electronic Device';
            },

            getDeviceModel(details) {
                if (!details) return 'Device Service';
                // Extract first phrase before comma, hyphen, or newline
                const firstPart = details.split(/[,;\n-]/)[0].trim();
                return firstPart.length > 3 ? firstPart : details.slice(0, 30);
            },

            getDeviceIssue(details) {
                if (!details) return '';
                const parts = details.split(/[,;\n-]/);
                if (parts.length > 1) {
                    return parts.slice(1).join(' - ').trim();
                }
                return details;
            },

            getStageIndex(status) {
                switch (status) {
                    case 'Pending': return 1;
                    case 'In Progress': return 2;
                    case 'Completed': return 3;
                    case 'Delivered': return 4;
                    case 'Cancelled': return 0;
                    default: return 1;
                }
            },

            getStagePercent(status) {
                switch (status) {
                    case 'Pending': return 25;
                    case 'In Progress': return 50;
                    case 'Completed': return 85;
                    case 'Delivered': return 100;
                    case 'Cancelled': return 0;
                    default: return 20;
                }
            },

            getStatusBadgeClass(status) {
                switch (status) {
                    case 'Pending':
                        return 'bg-amber-50 text-amber-700 border border-amber-200/80';
                    case 'In Progress':
                        return 'bg-blue-50 text-blue-700 border border-blue-200/80';
                    case 'Completed':
                        return 'bg-emerald-50 text-emerald-700 border border-emerald-200/80';
                    case 'Delivered':
                        return 'bg-slate-900 text-slate-100 border border-slate-800';
                    case 'Cancelled':
                        return 'bg-rose-50 text-rose-700 border border-rose-200/80';
                    case 'Reopened':
                        return 'bg-purple-50 text-purple-700 border border-purple-200/80';
                    default:
                        return 'bg-slate-50 text-slate-700 border border-slate-200';
                }
            },

            getTechnicianName(tech) {
                if (!tech) return 'Unassigned';
                if (typeof tech === 'object') return tech.name || tech.username || 'Assigned';
                const technician = this.technicians.find(t => t._id === tech || t.username === tech);
                return technician ? (technician.name || technician.username) : tech;
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
            }
        }));
    };

    if (window.Alpine) {
        initComponent();
    } else {
        document.addEventListener('alpine:init', initComponent);
    }
})();
