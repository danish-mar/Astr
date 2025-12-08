(function () {
    const initComponent = () => {
        Alpine.data('serviceTicketAdd', () => ({
            formData: {
                customer: '',
                deviceDetails: '',
                status: 'Pending',
                assignedTechnician: '',
                serviceCharge: 0,
                notes: ''
            },
            searchQuery: '',
            searchResults: [],
            showSearchResults: false,
            isSearching: false,
            selectedCustomer: null,
            technicians: [],
            saving: false,
            errors: {},

            // Quick Add Customer
            showQuickAddModal: false,
            quickCustomer: {
                name: '',
                phone: ''
            },

            get token() { return window.api.token; },

            async init() {
                if (!this.token) {
                    window.location.href = '/login';
                    return;
                }
                await this.loadTechnicians();
            },

            async loadTechnicians() {
                try {
                    const response = await window.api.get('/employees');
                    if (response.data && Array.isArray(response.data)) {
                        this.technicians = response.data;
                    }
                } catch (error) {
                    console.error('Error loading technicians:', error);
                }
            },

            async searchContacts() {
                if (this.searchQuery.length < 2) {
                    this.searchResults = [];
                    return;
                }

                this.isSearching = true;
                this.showSearchResults = true;
                try {
                    const response = await window.api.get(`/contacts?search=${this.searchQuery}&limit=5`);
                    if (response.data) {
                        this.searchResults = response.data.filter(c => c.contactType === 'Customer');
                    }
                } catch (error) {
                    console.error('Error searching contacts:', error);
                } finally {
                    this.isSearching = false;
                }
            },

            selectCustomer(contact) {
                this.selectedCustomer = contact;
                this.formData.customer = contact._id;
                this.searchQuery = ''; // Clear search query but keep selection visible via selectedCustomer
                this.showSearchResults = false;
                this.errors.customer = '';
            },

            clearCustomer() {
                this.selectedCustomer = null;
                this.formData.customer = '';
                this.searchQuery = '';
            },

            openQuickAddModal() {
                this.showQuickAddModal = true;
                this.quickCustomer = { name: '', phone: '' };
                this.showSearchResults = false;
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
                    this.selectCustomer(response.data);
                    this.showQuickAddModal = false;
                    window.showNotification('Customer added successfully');
                } catch (error) {
                    window.showNotification('Error adding customer: ' + (error.response?.data?.message || error.message), 'error');
                }
            },

            validate() {
                this.errors = {};
                let isValid = true;

                if (!this.formData.customer) {
                    this.errors.customer = 'Please select a customer';
                    isValid = false;
                }
                if (!this.formData.deviceDetails) {
                    this.errors.deviceDetails = 'Device details are required';
                    isValid = false;
                }

                return isValid;
            },

            async saveTicket() {
                if (!this.validate()) return;

                this.saving = true;
                try {
                    await window.api.post('/service-tickets', this.formData);
                    window.showNotification('Ticket created successfully');
                    setTimeout(() => {
                        window.location.href = '/service-tickets';
                    }, 1000);
                } catch (error) {
                    window.showNotification('Error creating ticket: ' + (error.response?.data?.message || error.message), 'error');
                    this.saving = false;
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
