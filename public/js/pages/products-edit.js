(function () {
    const initComponent = () => {
        Alpine.data('productEditData', () => ({
            saving: false,
            loading: true,
            productId: null,
            categories: [],
            contacts: [],
            selectedCategoryTemplate: [],
            newTag: '',
            imagePreviews: [],
            imageFiles: [],
            existingImages: [],
            showQuickAddContact: false,
            quickContact: {
                name: '',
                phone: '',
                contactType: ''
            },
            formData: {
                name: '',
                price: '',
                category: '',
                source: '',
                specifications: {},
                tags: [],
                notes: '',
                productID: ''
            },

            get token() {
                return window.api.token;
            },

            async init() {
                if (!this.token) {
                    window.location.href = '/login';
                    return;
                }

                // Get ID from URL: /products/edit/:id
                const pathParts = window.location.pathname.split('/');
                this.productId = pathParts[pathParts.length - 1];

                if (!this.productId) {
                    window.showNotification('Invalid product ID', 'error');
                    this.loading = false;
                    return;
                }

                // Load dependencies and product
                try {
                    const [categoriesRes, contactsRes, productRes] = await Promise.all([
                        window.api.get('/categories'),
                        window.api.get('/contacts?limit=100'),
                        window.api.get(`/products/${this.productId}`)
                    ]);
                    this.categories = categoriesRes.data;
                    this.contacts = contactsRes.data;
                    const product = productRes.data;

                    this.formData = {
                        name: product.name,
                        price: product.price,
                        category: product.category._id || product.category, // handle populated or unpopulated
                        source: product.source._id || product.source,
                        specifications: product.specifications || {},
                        tags: product.tags || [],
                        notes: product.notes || '',
                        productID: product.productID
                    };

                    this.existingImages = product.images || [];
                    // Pre-fill previews with existing images if they are URLs (our virtuals usually provide URLs)
                    // But in the model we store keys. The controller could pass full URLs or we construct them.
                    // For now, let's assume we can use the getImageUrl logic if we expose it or just use the keys if the proxy handles it.
                    // Actually, let's use the full URLs if available from the backend virtuals.
                    if (product.images) {
                        this.imagePreviews = product.images.map(img => img.startsWith('http') ? img : `/api/v1/products/image/${img}`);
                    }

                    // Trigger category template load
                    this.onCategoryChange();
                    this.loading = false;

                } catch (error) {
                    console.error('Error loading data', error);
                    window.showNotification('Error loading product data: ' + (error.response?.data?.message || error.message), 'error');
                    this.loading = false;
                }
            },

            onCategoryChange() {
                const category = this.categories.find(c => c._id === this.formData.category);
                this.selectedCategoryTemplate = category?.specificationsTemplate || [];
                // In edit mode, we DO NOT reset specifications when loading initial data
                // Only if user manually changes category, we might consider it, but let's keep data valid for now
                // Actually, if we change category manually, we *should* clear specs usually.
                // But init calls this too. Add check?
                // For simplicity: if formData.specifications is empty (which it isn't on init), reset? 
                // No, sticking with "keep existing values" is safer for edit.
            },

            getOptionValue(option) {
                return typeof option === 'string' ? option : option.value;
            },

            hasLinkedFields(fieldName) {
                const field = this.selectedCategoryTemplate.find(f => f.fieldName === fieldName);
                if (!field) return false;

                const selectedValue = this.formData.specifications[fieldName];
                if (!selectedValue) return false;

                const option = field.options.find(o => this.getOptionValue(o) === selectedValue);
                return typeof option === 'object' && option.linkedFields && option.linkedFields.length > 0;
            },

            getLinkedFields(fieldName) {
                const field = this.selectedCategoryTemplate.find(f => f.fieldName === fieldName);
                if (!field) return [];

                const selectedValue = this.formData.specifications[fieldName];
                const option = field.options.find(o => this.getOptionValue(o) === selectedValue);
                return option && typeof option === 'object' ? option.linkedFields : [];
            },

            hasSubOptions(fieldName) {
                const field = this.selectedCategoryTemplate.find(f => f.fieldName === fieldName);
                if (!field) return false;

                const selectedValue = this.formData.specifications[fieldName];
                if (!selectedValue) return false;

                const option = field.options.find(o => this.getOptionValue(o) === selectedValue);
                return typeof option === 'object' && option.subOptions && option.subOptions.length > 0;
            },

            getSubOptions(fieldName) {
                const field = this.selectedCategoryTemplate.find(f => f.fieldName === fieldName);
                if (!field) return [];

                const selectedValue = this.formData.specifications[fieldName];
                const option = field.options.find(o => this.getOptionValue(o) === selectedValue);
                return option && typeof option === 'object' ? option.subOptions : [];
            },

            handleImageUpload(event) {
                const files = Array.from(event.target.files);
                if ((this.imageFiles.length + this.existingImages.length + files.length) > 5) {
                    window.showNotification('Maximum 5 images allowed', 'error');
                    return;
                }

                files.forEach(file => {
                    this.imageFiles.push(file);
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        this.imagePreviews.push(e.target.result);
                    };
                    reader.readAsDataURL(file);
                });
            },

            removeImage(index) {
                // If it's an existing image, we need to track it for deletion if we want, 
                // but for now let's just remove from local state and update the array on save.
                this.imagePreviews.splice(index, 1);

                // If index is within existingImages range
                if (index < this.existingImages.length) {
                    this.existingImages.splice(index, 1);
                } else {
                    // It's a new file
                    this.imageFiles.splice(index - this.existingImages.length, 1);
                }
            },

            onSpecChange(fieldName) {
                // Clear sub-option if main option changes
                if (this.formData.specifications[fieldName + '_sub']) {
                    delete this.formData.specifications[fieldName + '_sub'];
                }

                // Clear linked fields logic (same as Add)
                const field = this.selectedCategoryTemplate.find(f => f.fieldName === fieldName);
                if (field && field.options) {
                    field.options.forEach(opt => {
                        if (typeof opt === 'object' && opt.linkedFields) {
                            opt.linkedFields.forEach(lf => {
                                if (!this.getLinkedFields(fieldName).find(validLf => validLf.fieldName === lf.fieldName)) {
                                    delete this.formData.specifications[lf.fieldName];
                                }
                            });
                        }
                    });
                }
            },

            addTag() {
                if (this.newTag.trim() && !this.formData.tags.includes(this.newTag.trim())) {
                    this.formData.tags.push(this.newTag.trim());
                    this.newTag = '';
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

            async saveProduct() {
                if (!this.formData.name || !this.formData.category || !this.formData.source || !this.formData.price) {
                    window.showNotification('Please fill all required fields', 'error');
                    return;
                }

                this.saving = true;
                try {
                    const formData = new FormData();

                    // Simple fields
                    formData.append('name', this.formData.name);
                    formData.append('price', this.formData.price);
                    formData.append('category', this.formData.category);
                    formData.append('source', this.formData.source);
                    formData.append('notes', this.formData.notes || '');

                    // Complex fields
                    formData.append('specifications', JSON.stringify(this.formData.specifications));
                    formData.append('tags', JSON.stringify(this.formData.tags));

                    // New Images
                    this.imageFiles.forEach(file => {
                        formData.append('images', file);
                    });

                    // Track kept existing images (keys ONLY)
                    formData.append('existingImages', JSON.stringify(this.existingImages));

                    await axios.put(`/api/v1/products/${this.productId}`, formData, {
                        headers: {
                            'Content-Type': 'multipart/form-data',
                            'Authorization': `Bearer ${this.token}`
                        }
                    });

                    window.showNotification('Product updated successfully!');
                    setTimeout(() => {
                        window.location.href = '/products';
                    }, 1000);
                } catch (error) {
                    window.showNotification('Error updating product: ' + (error.response?.data?.message || error.message), 'error');
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
