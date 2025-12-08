(function () {
    const initComponent = () => {
        Alpine.data('productsData', () => ({
            // Component-specific data
            products: [],
            categories: [],
            contacts: [],
            loading: true,
            viewMode: 'grid',
            filters: {
                search: '',
                category: '',
                isSold: null
            },
            showModal: false,
            editMode: false,
            saving: false,
            formData: {
                name: '',
                price: '',
                category: '',
                source: '',
                specifications: {},
                tags: [],
                notes: '',
                assignProductID: false
            },
            selectedCategoryTemplate: [],
            newTag: '',
            showQuickAddContact: false,
            quickContact: {
                name: '',
                phone: '',
                contactType: ''
            },

            // Get parent data
            get token() {
                return window.api.token;
            },

            get user() {
                return window.api.user;
            },

            async init() {
                // Check authentication
                if (!this.token) {
                    window.location.href = '/login';
                    return;
                }

                await Promise.all([
                    this.loadProducts(),
                    this.loadCategories(),
                    this.loadContacts()
                ]);

                // Check if we should open the add modal
                if (window.location.pathname === '/products/add') {
                    this.openAddModal();
                }
            },

            async loadProducts() {
                this.loading = true;
                try {
                    let query = '?page=1&limit=100';
                    if (this.filters.search) query += `&search=${this.filters.search}`;
                    if (this.filters.category) query += `&category=${this.filters.category}`;
                    if (this.filters.isSold !== null) query += `&isSold=${this.filters.isSold}`;

                    const response = await window.api.get(`/products${query}`);
                    this.products = response.data; // For paginated response, data is in response.data
                } catch (error) {
                    console.error('Error loading products:', error);
                    window.showNotification('Error loading products. Please try again.', 'error');
                } finally {
                    this.loading = false;
                }
            },

            async loadCategories() {
                try {
                    const response = await window.api.get('/categories');
                    this.categories = response.data;
                } catch (error) {
                    console.error('Error loading categories:', error);
                }
            },

            async loadContacts() {
                try {
                    const response = await window.api.get('/contacts?page=1&limit=100');
                    this.contacts = response.data; // For paginated response, data is in response.data
                } catch (error) {
                    console.error('Error loading contacts:', error);
                }
            },

            onCategoryChange(preserveSpecs = false) {
                const category = this.categories.find(c => c._id === this.formData.category);
                this.selectedCategoryTemplate = category?.specificationsTemplate || [];
                if (!preserveSpecs) {
                    this.formData.specifications = {};
                }
            },

            async saveQuickContact() {
                if (!this.quickContact.name || !this.quickContact.phone || !this.quickContact.contactType) {
                    window.showNotification('Please fill all required fields', 'error');
                    return;
                }

                try {
                    const response = await window.api.post('/contacts', this.quickContact);
                    this.contacts.push(response.data);
                    this.formData.source = response.data._id;
                    this.showQuickAddContact = false;
                    this.quickContact = { name: '', phone: '', contactType: '' };
                    window.showNotification('Contact added successfully!');
                } catch (error) {
                    window.showNotification('Error creating contact: ' + (error.response?.data?.message || error.message), 'error');
                }
            },

            addTag() {
                if (this.newTag.trim() && !this.formData.tags.includes(this.newTag.trim())) {
                    this.formData.tags.push(this.newTag.trim());
                    this.newTag = '';
                }
            },

            openAddModal() {
                this.editMode = false;
                this.formData = {
                    name: '',
                    category: '',
                    source: '',
                    specifications: {},
                    tags: [],
                    notes: '',
                    assignProductID: false
                };
                this.selectedCategoryTemplate = [];
                this.showModal = true;
            },

            editProduct(product) {
                this.editMode = true;
                this.formData = {
                    _id: product._id,
                    name: product.name,
                    price: product.price,
                    category: typeof product.category === 'object' ? product.category._id : product.category,
                    source: typeof product.source === 'object' ? product.source._id : product.source,
                    specifications: product.specifications || {},
                    tags: product.tags || [],
                    notes: product.notes || '',
                    assignProductID: false
                };
                this.onCategoryChange(true);
                this.showModal = true;
            },

            async saveProduct() {
                if (!this.formData.name || !this.formData.category || !this.formData.source || !this.formData.price) {
                    window.showNotification('Please fill all required fields', 'error');
                    return;
                }

                this.saving = true;
                try {
                    if (this.editMode) {
                        await window.api.put(`/products/${this.formData._id}`, this.formData);
                        window.showNotification('Product updated successfully!');
                    } else {
                        await window.api.post('/products', this.formData);
                        window.showNotification('Product added successfully!');
                    }

                    await this.loadProducts();
                    this.closeModal();
                } catch (error) {
                    window.showNotification('Error saving product: ' + (error.response?.data?.message || error.message), 'error');
                } finally {
                    this.saving = false;
                }
            },

            async markAsSold(productId) {
                window.showConfirm('Mark as Sold', 'Are you sure you want to mark this product as sold?', async () => {
                    try {
                        await window.api.patch(`/products/${productId}/mark-sold`);
                        window.showNotification('Product marked as sold!');
                        await this.loadProducts();
                    } catch (error) {
                        window.showNotification('Error marking product as sold: ' + (error.response?.data?.message || error.message), 'error');
                    }
                });
            },

            async deleteProduct(productId) {
                window.showConfirm('Delete Product', 'Are you sure you want to delete this product? This action cannot be undone.', async () => {
                    try {
                        await window.api.delete(`/products/${productId}`);
                        window.showNotification('Product deleted successfully');
                        await this.loadProducts();
                    } catch (error) {
                        window.showNotification('Error deleting product: ' + (error.response?.data?.message || error.message), 'error');
                    }
                });
            },

            viewProduct(product) {
                // TODO: Implement product detail view
                console.log('View product:', product);
                window.showNotification('Product detail view - Coming soon!', 'info');
            },

            closeModal() {
                this.showModal = false;
                this.showQuickAddContact = false;
            }
        }));
    };

    if (window.Alpine) {
        initComponent();
    } else {
        document.addEventListener('alpine:init', initComponent);
    }
})();
