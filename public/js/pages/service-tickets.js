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
                notes: '',
                receivedDate: new Date().toISOString().split('T')[0]
            },
            showQuickAddCustomer: false,
            quickCustomer: {
                name: '',
                phone: ''
            },

            technicians: [],


            // Search in Modal
            searchResults: [],
            isSearching: false,
            selectedCustomer: null,

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

                // Check for edit query param
                const urlParams = new URLSearchParams(window.location.search);
                const editId = urlParams.get('edit');
                if (editId) {
                    const ticketToEdit = this.tickets.find(t => t._id === editId);
                    if (ticketToEdit) {
                        this.editTicket(ticketToEdit);
                    } else {
                        // If not in first page, fetch specifically
                        try {
                            const response = await window.api.get(`/service-tickets/${editId}`);
                            if (response.data) {
                                this.editTicket(response.data);
                            }
                        } catch (e) {
                            console.error('Failed to fetch ticket for editing', e);
                        }
                    }
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
                    const response = await window.api.get('/employees?limit=100');
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
                    notes: '',
                    receivedDate: new Date().toISOString().split('T')[0]
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
                    notes: ticket.notes || '',
                    receivedDate: ticket.receivedDate ? new Date(ticket.receivedDate).toISOString().split('T')[0] : (ticket.createdAt ? new Date(ticket.createdAt).toISOString().split('T')[0] : '')
                };

                // Set selectedCustomer for modal display
                this.selectedCustomer = typeof ticket.customer === 'object' ? ticket.customer : null;

                this.showModal = true;
            },

            viewTicket(ticket) {
                window.location.href = `/service-tickets/${ticket._id}`;
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
                this.selectedCustomer = null;
                this.searchResults = [];
            },

            async searchContactsInModal(query) {
                if (query.length < 2) {
                    this.searchResults = [];
                    return;
                }

                this.isSearching = true;
                try {
                    const response = await window.api.get(`/contacts?search=${query}&limit=5`);
                    if (response.data) {
                        this.searchResults = response.data.filter(c => c.contactType === 'Customer');
                    }
                } catch (error) {
                    console.error('Error searching contacts:', error);
                } finally {
                    this.isSearching = false;
                }
            },

            getTechnicianName(tech) {
                if (!tech) return 'Awaiting Assignment';
                if (typeof tech === 'object') return tech.name || 'Unknown Tech';
                const technician = this.technicians.find(t => t._id === tech || t.username === tech);
                return technician ? (technician.name || technician.username) : tech;
            },

            selectCustomerInModal(contact) {
                this.selectedCustomer = contact;
                this.formData.customer = contact._id;
                this.searchResults = [];
            },

            clearCustomerSelection() {
                this.selectedCustomer = null;
                this.formData.customer = '';
            }
        }));
    };

    if (window.Alpine) {
        initComponent();
    } else {
        document.addEventListener('alpine:init', initComponent);
    }
})();
