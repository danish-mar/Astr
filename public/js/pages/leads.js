function leadsData() {
    return {
        // Tab state: 'whatsapp' (AI Deals Pipeline) vs 'manual' (Manual CRM Leads)
        activeTab: 'whatsapp',

        // WhatsApp AI Sales & Inquiries Data
        whatsapp: {
            metrics: {
                todayInquiries: 0,
                todayDeals: 0,
                todaySales: 0,
                todayProfit: 0,
                totalDeals: 0,
                totalSales: 0,
                totalProfit: 0,
            },
            agentStatus: {
                status: 'INITIALIZING',
                isReady: false,
                loadingPercent: 0,
                loadingMessage: '',
                awaitingVendorCount: 0,
            },
            inquiries: [],
            filterStatus: 'all',
            selectedInquiry: null,
            loading: false,
            pollingInterval: null,
        },

        // Manual CRM Leads Data
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

        get filteredWhatsAppInquiries() {
            if (this.whatsapp.filterStatus === 'all') return this.whatsapp.inquiries;
            return this.whatsapp.inquiries.filter(i => i.status === this.whatsapp.filterStatus);
        },

        async init() {
            await Promise.all([
                this.fetchWhatsAppSales(),
                this.fetchLeads(),
                this.fetchStats(),
                this.fetchReferenceData()
            ]);

            // Poll WhatsApp AI status & inquiries every 3.5s
            this.whatsapp.pollingInterval = setInterval(() => {
                this.fetchWhatsAppSales();
            }, 3500);

            // Deep linking: Open lead modal if ID is in URL or Hash
            const urlParams = new URLSearchParams(window.location.search);
            const leadId = urlParams.get('id') || urlParams.get('leadId') || window.location.hash.replace('#', '');
            
            if (leadId && leadId.length >= 24) {
                this.activeTab = 'manual';
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

        // ── WhatsApp AI Sales & Inquiries ────────────────────────────────────

        async fetchWhatsAppSales() {
            try {
                const res = await window.api.get('/whatsapp/sales');
                if (res && res.data) {
                    this.whatsapp.metrics = res.data.metrics || this.whatsapp.metrics;
                    this.whatsapp.agentStatus = res.data.agentStatus || this.whatsapp.agentStatus;
                    this.whatsapp.inquiries = res.data.inquiries || [];
                }
            } catch (error) {
                // If not authenticated or service starting, fail silently in background poll
                console.warn('WhatsApp sales poll notice:', error.message);
            }
        },

        formatCustomerPhone(inq) {
            if (!inq) return '—';
            // 1. If verified real phone is present, format cleanly
            const phone = inq.customerRealPhone || (!inq.customerPhone?.includes('@lid') ? inq.customerPhone : '');
            if (phone) {
                const digits = phone.replace(/\D/g, '');
                if (digits.startsWith('91')) {
                    const local = digits.slice(2);
                    if (local.length === 10) {
                        return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
                    }
                    return `+91 ${local}`;
                } else if (digits === '923167255624') {
                    return `+91 923167255624`;
                } else if (digits.startsWith('92') && digits.length === 12) {
                    return `+92 ${digits.slice(2, 5)} ${digits.slice(5)}`;
                } else if (digits.length === 10) {
                    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
                }
                return `+${digits}`;
            }

            // Fallback when phone is protected by WhatsApp privacy
            return 'WhatsApp Direct (Privacy Protected)';
        },

        openCostingModal(inq) {
            this.whatsapp.selectedInquiry = inq;
        },

        closeCostingModal() {
            this.whatsapp.selectedInquiry = null;
        },

        formatCurrency(num) {
            return '₹' + Number(num || 0).toLocaleString('en-IN');
        },

        formatDate(dateStr) {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        },

        // ── Manual CRM Leads ─────────────────────────────────────────────────

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
        },

        destroy() {
            if (this.whatsapp.pollingInterval) {
                clearInterval(this.whatsapp.pollingInterval);
            }
        }
    };
}
