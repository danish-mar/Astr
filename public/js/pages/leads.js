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

                const res = await this.api(`/leads?${params.toString()}`);
                this.leads = res.data;
                this.totalLeads = res.pagination.total;
            } catch (error) {
                this.$store.app.notify('Error fetching leads', 'error');
            } finally {
                this.loading = false;
            }
        },

        async fetchStats() {
            try {
                const res = await this.api('/leads/stats');
                this.stats = res.data;
            } catch (error) {
                console.error('Error fetching stats:', error);
            }
        },

        async fetchReferenceData() {
            try {
                // Fetch customers
                const contactRes = await this.api('/contacts?limit=1000&contactType=Customer');
                this.customers = contactRes.data;

                // Fetch products
                const productRes = await this.api('/products?limit=1000');
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
                    await this.api(`/leads/${this.formData._id}`, 'PUT', this.formData);
                    this.$store.app.notify('Lead updated successfully');
                } else {
                    await this.api('/leads', 'POST', this.formData);
                    this.$store.app.notify('Lead created successfully');
                }
                this.closeModal();
                await this.fetchLeads();
                await this.fetchStats();
            } catch (error) {
                this.$store.app.notify(error.response?.data?.message || 'Error saving lead', 'error');
            }
        },

        async deleteLead(id) {
            this.$store.app.confirm('Delete Lead', 'Are you sure you want to delete this lead? This action cannot be undone.', async () => {
                try {
                    await this.api(`/leads/${id}`, 'DELETE');
                    this.$store.app.notify('Lead deleted successfully');
                    await this.fetchLeads();
                    await this.fetchStats();
                } catch (error) {
                    this.$store.app.notify('Error deleting lead', 'error');
                }
            });
        }
    };
}
