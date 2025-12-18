(function () {
    const initComponent = () => {
        Alpine.data('categoriesData', () => ({
            categories: [],
            loading: true,

            get token() { return window.api.token; },

            async init() {
                if (!this.token) {
                    window.location.href = '/login';
                    return;
                }
                await this.loadCategories();
            },

            async loadCategories() {
                this.loading = true;
                try {
                    const response = await window.api.get('/categories/with-count');
                    this.categories = response.data;
                } catch (error) {
                    console.error('Error loading categories:', error);
                    // Fallback to normal get if with-count fails (though it shouldn't)
                    try {
                        const response = await window.api.get('/categories');
                        this.categories = response.data;
                    } catch (e) {
                        console.error('Fallback failed:', e);
                    }
                } finally {
                    this.loading = false;
                }
            },

            async deleteCategory(id) {
                window.showConfirm('Delete Category', 'Are you sure you want to delete this category?', async () => {
                    try {
                        await window.api.delete(`/categories/${id}`);
                        window.showNotification('Category deleted successfully');
                        this.loadCategories();
                    } catch (error) {
                        window.showNotification('Error deleting category: ' + (error.response?.data?.message || error.message), 'error');
                    }
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
