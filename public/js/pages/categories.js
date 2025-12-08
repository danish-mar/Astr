(function () {
    const initComponent = () => {
        Alpine.data('categoriesData', () => ({
            categories: [],
            loading: true,
            showModal: false,
            editMode: false,
            saving: false,
            formData: {
                name: '',
                description: '',
                specificationsTemplate: []
            },

            get token() { return window.api.token; },

            async init() {
                if (!this.token) {
                    window.location.href = '/login';
                    return;
                }
                await this.loadCategories();

                // Check if we should open the add modal
                if (window.location.pathname === '/categories/add') {
                    this.openAddModal();
                }
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

            openAddModal() {
                this.editMode = false;
                this.formData = {
                    name: '',
                    description: '',
                    specificationsTemplate: []
                };
                this.showModal = true;
            },

            editCategory(category) {
                this.editMode = true;
                this.formData = {
                    _id: category._id,
                    name: category.name,
                    description: category.description || '',
                    specificationsTemplate: (category.specificationsTemplate || []).map(field => ({
                        ...field,
                        optionsInput: field.options ? field.options.join(', ') : ''
                    }))
                };
                this.showModal = true;
            },

            addSpecField() {
                this.formData.specificationsTemplate.push({
                    fieldName: '',
                    fieldType: 'text',
                    required: false,
                    options: [],
                    optionsInput: ''
                });
            },

            removeSpecField(index) {
                this.formData.specificationsTemplate.splice(index, 1);
            },

            async saveCategory() {
                if (!this.formData.name) {
                    window.showNotification('Category name is required', 'error');
                    return;
                }

                // Process options for select fields
                const processedTemplate = this.formData.specificationsTemplate.map(field => {
                    const newField = { ...field };
                    if (field.fieldType === 'select' && field.optionsInput) {
                        newField.options = field.optionsInput.split(',').map(o => o.trim()).filter(o => o);
                    }
                    delete newField.optionsInput; // Remove temporary field
                    return newField;
                });

                const payload = {
                    ...this.formData,
                    specificationsTemplate: processedTemplate
                };

                this.saving = true;
                try {
                    if (this.editMode) {
                        await window.api.put(`/categories/${this.formData._id}`, payload);
                        window.showNotification('Category updated successfully');
                    } else {
                        await window.api.post('/categories', payload);
                        window.showNotification('Category created successfully');
                    }
                    this.closeModal();
                    this.loadCategories();
                } catch (error) {
                    window.showNotification('Error saving category: ' + (error.response?.data?.message || error.message), 'error');
                } finally {
                    this.saving = false;
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
            },

            closeModal() {
                this.showModal = false;
            }
        }));
    };

    if (window.Alpine) {
        initComponent();
    } else {
        document.addEventListener('alpine:init', initComponent);
    }
})();
