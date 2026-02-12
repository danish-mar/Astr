function leadsData() {
    return {
        leads: [],
        customers: [],
        products: [],
        stats: {},
        loading: false,

        // Pagination & Filtering
        page: 1,
        limit: 10,
        totalLeads: 0,
        search: '',
        filterStatus: 'All',
        filterDate: '',

        // Modal
        modalOpen: false,
        isEdit: false,
        formData: {
            customer: '',
            product: '',
            status: 'New',
            estimatedValue: 0,
            source: '',
            notes: '',
        },

        async init() {
            await Promise.all([
                this.fetchLeads(),
                this.fetchStats(),
                this.fetchReferenceData()
            ]);

            // Deep linking: Open lead modal if ID is in URL or Hash
            const urlParams = new URLSearchParams(window.location.search);
            const leadId = urlParams.get('id') || urlParams.get('leadId') || window.location.hash.replace('#', '');
            
            if (leadId && leadId.length >= 24) {
                // Find in current list or fetch fresh
                const existing = this.leads.find(l => l._id === leadId);
                if (existing) {
                    this.openEditModal(existing);
                } else {
                    try {
                        const res = await window.api.get(`/leads/${leadId}`);
                        if (res.data) this.openEditModal(res.data);
                    } catch (e) {
                        console.error('Deep link lead not found', e);
                    }
                }
            }
        },

        async fetchLeads() {
            this.loading = true;
            try {
                const params = new URLSearchParams({
                    page: this.page,
                    limit: this.limit,
                    search: this.search,
                });
                if (this.filterStatus !== 'All') {
                    params.append('status', this.filterStatus);
                }
                if (this.filterDate) {
                    params.append('date', this.filterDate);
                }

                const res = await window.api.get(`/leads?${params.toString()}`);
                this.leads = res.data;
                this.totalLeads = res.pagination.total;
            } catch (error) {
                window.showNotification('Error fetching leads', 'error');
            } finally {
                this.loading = false;
            }
        },

        async fetchStats() {
            try {
                const res = await window.api.get('/leads/stats');
                this.stats = res.data;
            } catch (error) {
                console.error('Error fetching stats:', error);
            }
        },

        async fetchReferenceData() {
            try {
                // Fetch customers
                const contactRes = await window.api.get('/contacts?limit=1000&contactType=Customer');
                this.customers = contactRes.data;

                // Fetch products
                const productRes = await window.api.get('/products?limit=1000');
                this.products = productRes.data;
            } catch (error) {
                console.error('Error fetching reference data:', error);
            }
        },

        openAddModal() {
            this.isEdit = false;
            this.formData = {
                customer: '',
                product: '',
                status: 'New',
                estimatedValue: 0,
                source: '',
                notes: '',
            };
            this.modalOpen = true;
        },

        openEditModal(lead) {
            this.isEdit = true;
            this.formData = {
                _id: lead._id,
                customer: lead.customer._id,
                product: lead.product._id,
                status: lead.status,
                estimatedValue: lead.estimatedValue,
                source: lead.source,
                notes: lead.notes,
            };
            this.modalOpen = true;
        },

        closeModal() {
            this.modalOpen = false;
        },

        async saveLead() {
            try {
                if (this.isEdit) {
                    await window.api.put(`/leads/${this.formData._id}`, this.formData);
                    window.showNotification('Lead updated successfully');
                } else {
                    await window.api.post('/leads', this.formData);
                    window.showNotification('Lead created successfully');
                }
                this.closeModal();
                await this.fetchLeads();
                await this.fetchStats();
            } catch (error) {
                window.showNotification(error.response?.data?.message || 'Error saving lead', 'error');
            }
        },

        async deleteLead(id) {
            window.showConfirm('Delete Lead', 'Are you sure you want to delete this lead? This action cannot be undone.', async () => {
                try {
                    await window.api.delete(`/leads/${id}`);
                    window.showNotification('Lead deleted successfully');
                    await this.fetchLeads();
                    await this.fetchStats();
                } catch (error) {
                    window.showNotification('Error deleting lead', 'error');
                }
            });
        },

        clearFilters() {
            this.search = '';
            this.filterStatus = 'All';
            this.filterDate = '';
            this.page = 1;
            this.fetchLeads();
        }
    };
}
