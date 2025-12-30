(function () {
    const initComponent = () => {
        Alpine.data('contactsData', () => ({
            contacts: [],
            loading: true,
            filters: {
                search: '',
                contactType: 'All'
            },
            pagination: {
                page: 1,
                limit: 10,
                total: 0
            },
            viewMode: 'list',
            showModal: false,
            showViewModal: false,
            editMode: false,
            saving: false,
            selectedContact: null,
            contactTickets: [],
            contactLedgers: [],
            formData: {
                name: '',
                phone: '',
                contactType: 'Customer',
                companyName: '',
                address: '',
                notes: ''
            },

            get token() { return window.api.token; },

            async init() {
                if (!this.token) {
                    window.location.href = '/login';
                    return;
                }
                await this.loadContacts();

                // Handle deep linking for ?id=
                const urlParams = new URLSearchParams(window.location.search);
                const contactId = urlParams.get('id');
                if (contactId) {
                    const contact = this.contacts.find(c => c._id === contactId);
                    if (contact) {
                        this.viewContact(contact);
                    } else {
                        // If not in first page, fetch it specifically
                        try {
                            const res = await window.api.get(`/contacts/${contactId}`);
                            if (res.data) this.viewContact(res.data);
                        } catch (e) {
                            console.error('Deep link contact not found', e);
                        }
                    }
                }

                // Check if we should open the add modal
                if (window.location.pathname === '/contacts/add') {
                    this.openAddModal();
                }
            },

            async loadContacts() {
                this.loading = true;
                try {
                    let query = `?page=${this.pagination.page}&limit=${this.pagination.limit}`;
                    if (this.filters.search) query += `&search=${this.filters.search}`;
                    if (this.filters.contactType !== 'All') query += `&contactType=${this.filters.contactType}`;

                    const response = await window.api.get(`/contacts${query}`);
                    this.contacts = response.data;
                    if (response.pagination) {
                        this.pagination = response.pagination;
                    }
                } catch (error) {
                    console.error('Error loading contacts:', error);
                } finally {
                    this.loading = false;
                }
            },

            changePage(page) {
                this.pagination.page = page;
                this.loadContacts();
            },

            openAddModal() {
                this.editMode = false;
                this.formData = {
                    name: '',
                    phone: '',
                    contactType: 'Customer',
                    companyName: '',
                    address: '',
                    notes: ''
                };
                this.showModal = true;
            },

            editContact(contact) {
                this.editMode = true;
                this.formData = {
                    _id: contact._id,
                    name: contact.name,
                    phone: contact.phone,
                    contactType: contact.contactType,
                    companyName: contact.companyName || '',
                    address: contact.address || '',
                    notes: contact.notes || ''
                };
                this.showModal = true;
            },

            async saveContact() {
                if (!this.formData.name || !this.formData.phone) {
                    window.showNotification('Name and phone are required', 'error');
                    return;
                }

                this.saving = true;
                try {
                    if (this.editMode) {
                        await window.api.put(`/contacts/${this.formData._id}`, this.formData);
                        window.showNotification('Contact updated successfully');
                    } else {
                        await window.api.post('/contacts', this.formData);
                        window.showNotification('Contact created successfully');
                    }
                    this.closeModal();
                    this.loadContacts();
                } catch (error) {
                    window.showNotification('Error saving contact: ' + (error.response?.data?.message || error.message), 'error');
                } finally {
                    this.saving = false;
                }
            },

            async deleteContact(id) {
                window.showConfirm('Delete Contact', 'Are you sure you want to delete this contact?', async () => {
                    try {
                        await window.api.delete(`/contacts/${id}`);
                        window.showNotification('Contact deleted successfully');
                        this.loadContacts();
                    } catch (error) {
                        window.showNotification('Error deleting contact: ' + (error.response?.data?.message || error.message), 'error');
                    }
                });
            },

            closeModal() {
                this.showModal = false;
            },

            async viewContact(contact) {
                this.selectedContact = contact;
                this.contactTickets = [];
                this.showViewModal = true;

                try {
                    const response = await window.api.get(`/service-tickets/customer/${contact._id}`);
                    this.contactTickets = response.data;
                } catch (error) {
                    console.error('Error loading contact tickets:', error);
                }

                try {
                    const response = await window.api.get(`/accounting/contact/${contact._id}`);
                    this.contactLedgers = response.data;
                } catch (error) {
                    console.error('Error loading contact ledgers:', error);
                }
            },

            closeViewModal() {
                this.showViewModal = false;
                this.selectedContact = null;
                this.contactTickets = [];
                this.contactLedgers = [];
            },

            formatLedgerNumber(num) {
                return new Intl.NumberFormat('en-IN', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                }).format(num || 0);
            },

            formatLedgerDate(dateStr) {
                return new Date(dateStr).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                });
            }
        }));
    };

    if (window.Alpine) {
        initComponent();
    } else {
        document.addEventListener('alpine:init', initComponent);
    }
})();
