(function () {
    const initComponent = () => {
        Alpine.data('serviceTicketsData', () => ({
            tickets: [],
            customers: [],
            loading: true,
            filters: {
                search: '',
                status: 'All'
            },
            pagination: {
                page: 1,
                limit: 10,
                total: 0
            },
            viewMode: 'list',
            showModal: false,
            editMode: false,
            saving: false,
            formData: {
                ticketNumber: '',
                customer: '',
                deviceDetails: '',
                status: 'Pending',
                assignedTechnician: '',
                serviceCharge: 0,
                notes: ''
            },
            showQuickAddCustomer: false,
            quickCustomer: {
                name: '',
                phone: ''
            },

            technicians: [],
            showViewModal: false,
            selectedTicket: null,

            get token() { return window.api.token; },
            get user() { return window.api.user; },

            async init() {
                if (!this.token) {
                    window.location.href = '/login';
                    return;
                }
                await Promise.all([
                    this.loadTickets(),
                    this.loadCustomers(),
                    this.loadTechnicians()
                ]);

                // Check if we should open the add modal
                if (window.location.pathname === '/service-tickets/add') {
                    this.openAddModal();
                }
            },

            async loadTickets() {
                this.loading = true;
                try {
                    let query = `?page=${this.pagination.page}&limit=${this.pagination.limit}`;
                    if (this.filters.search) query += `&search=${this.filters.search}`;
                    if (this.filters.status !== 'All') query += `&status=${this.filters.status}`;

                    const response = await window.api.get(`/service-tickets${query}`);
                    this.tickets = response.data;
                    if (response.pagination) {
                        this.pagination = response.pagination;
                    }
                } catch (error) {
                    console.error('Error loading tickets:', error);
                } finally {
                    this.loading = false;
                }
            },

            async loadCustomers() {
                try {
                    // Fetch contacts and filter for customers
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
                    const response = await window.api.get('/employees');
                    if (response.data && Array.isArray(response.data)) {
                        // Filter for technicians if needed, or show all staff
                        // For now, showing all employees as potential assignees
                        this.technicians = response.data;
                    }
                } catch (error) {
                    console.error('Error loading technicians:', error);
                }
            },

            changePage(page) {
                this.pagination.page = page;
                this.loadTickets();
            },

            openAddModal() {
                this.editMode = false;
                this.formData = {
                    ticketNumber: '',
                    customer: '',
                    deviceDetails: '',
                    status: 'Pending',
                    assignedTechnician: '',
                    serviceCharge: 0,
                    notes: ''
                };
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
                    notes: ticket.notes || ''
                };
                this.showModal = true;
            },

            viewTicket(ticket) {
                this.selectedTicket = ticket;
                this.showViewModal = true;
            },

            closeViewModal() {
                this.showViewModal = false;
                this.selectedTicket = null;
            },

            async saveTicket() {
                if (!this.formData.customer || !this.formData.deviceDetails) {
                    window.showNotification('Please fill all required fields', 'error');
                    return;
                }

                this.saving = true;
                try {
                    if (this.editMode) {
                        await window.api.put(`/service-tickets/${this.formData._id}`, this.formData);
                        window.showNotification('Ticket updated successfully');
                    } else {
                        await window.api.post('/service-tickets', this.formData);
                        window.showNotification('Ticket created successfully');
                    }
                    this.closeModal();
                    this.loadTickets();
                } catch (error) {
                    window.showNotification('Error saving ticket: ' + (error.response?.data?.message || error.message), 'error');
                } finally {
                    this.saving = false;
                }
            },

            async updateStatus(id, status) {
                try {
                    await window.api.patch(`/service-tickets/${id}/status`, { status });
                    this.loadTickets();
                } catch (error) {
                    window.showNotification('Error updating status: ' + (error.response?.data?.message || error.message), 'error');
                }
            },

            async saveQuickCustomer() {
                if (!this.quickCustomer.name || !this.quickCustomer.phone) {
                    window.showNotification('Please fill name and phone', 'error');
                    return;
                }

                try {
                    const payload = {
                        ...this.quickCustomer,
                        contactType: 'Customer'
                    };
                    const response = await window.api.post('/contacts', payload);
                    this.customers.push(response.data);
                    this.formData.customer = response.data._id;
                    this.showQuickAddCustomer = false;
                    this.quickCustomer = { name: '', phone: '' };
                    window.showNotification('Customer added successfully');
                } catch (error) {
                    window.showNotification('Error adding customer: ' + (error.response?.data?.message || error.message), 'error');
                }
            },

            closeModal() {
                this.showModal = false;
                this.showQuickAddCustomer = false;
            }
        }));
    };

    if (window.Alpine) {
        initComponent();
    } else {
        document.addEventListener('alpine:init', initComponent);
    }
})();
