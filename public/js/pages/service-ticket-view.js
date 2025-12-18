(function () {
    const initComponent = () => {
        Alpine.data('serviceTicketViewData', () => ({
            ticket: null,
            loading: true,
            ticketId: null,
            technicians: [],

            get token() { return window.api.token; },

            async init() {
                if (!this.token) {
                    window.location.href = '/login';
                    return;
                }

                // Extract ID from URL path /service-tickets/:id
                const pathParts = window.location.pathname.split('/');
                this.ticketId = pathParts[pathParts.length - 1];

                if (!this.ticketId || this.ticketId === 'service-tickets') {
                    window.location.href = '/service-tickets';
                    return;
                }

                await Promise.all([
                    this.loadTicket(),
                    this.loadTechnicians()
                ]);
            },

            async loadTechnicians() {
                try {
                    const response = await window.api.get('/employees?limit=100');
                    this.technicians = response.data;
                } catch (error) {
                    console.error('Error loading technicians:', error);
                }
            },

            getTechnicianName(tech) {
                if (!tech) return 'Awaiting Assignment';
                if (typeof tech === 'object') return tech.name || 'Unknown Tech';
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
                    window.showNotification('Error loading ticket details', 'error');
                } finally {
                    this.loading = false;
                }
            },

            formatDate(dateString) {
                if (!dateString) return 'N/A';
                return new Date(dateString).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            },

            editTicket() {
                // Redirect to edit (or open modal if we wanted to stay on same page)
                // For now, let's redirect to tickets list with the ID to trigger the edit modal logic
                window.location.href = `/service-tickets?edit=${this.ticketId}`;
            }
        }));
    };

    if (window.Alpine) {
        initComponent();
    } else {
        document.addEventListener('alpine:init', initComponent);
    }
})();
