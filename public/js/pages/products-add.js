(function () {
    const initComponent = () => {
        Alpine.data('productAddData', () => ({
            saving: false,
            categories: [],
            contacts: [],
            selectedCategoryTemplate: [],
            newTag: '',
            imagePreviews: [],
            imageFiles: [],
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
                assignProductID: false
            },

            get token() {
                return window.api.token;
            },

            async init() {
                if (!this.token) {
                    window.location.href = '/login';
                    return;
                }

                // Load dependencies
                try {
                    const [categoriesRes, contactsRes] = await Promise.all([
                        window.api.get('/categories'),
                        window.api.get('/contacts?limit=100')
                    ]);
                    this.categories = categoriesRes.data;
                    this.contacts = contactsRes.data;
                } catch (error) {
                    console.error('Error loading dependencies', error);
                }
            },

            onCategoryChange() {
                const category = this.categories.find(c => c._id === this.formData.category);
                this.selectedCategoryTemplate = category?.specificationsTemplate || [];
                // Reset specs but attempt to preserve common keys if valid? Simpler to reset for consistency.
                this.formData.specifications = {};
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

            handleImageUpload(event) {
                const files = Array.from(event.target.files);
                if (this.imageFiles.length + files.length > 5) {
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
                this.imageFiles.splice(index, 1);
                this.imagePreviews.splice(index, 1);
            },

            onSpecChange(fieldName) {
                // Clear sub-option if main option changes
                if (this.formData.specifications[fieldName + '_sub']) {
                    delete this.formData.specifications[fieldName + '_sub'];
                }

                // Clear linked fields if main option changes
                // finding previous linked fields is hard without tracking state, but we can just let them stay or try to clean up
                // A better approach: When rendering, we rely on current state.
                // Cleanup: Iterate through all linked fields of the UNSELECTED option? Hard.
                // Simpler: Just rely on flat structure. If user switches from Intel to AMD, "Generation"(Intel) value remains in formData?
                // Yes, it might remain. We should try to clear it.
                // Loop through ALL options of this field, find their linked fields, and delete them from formData.
                // This is safer.
                const field = this.selectedCategoryTemplate.find(f => f.fieldName === fieldName);
                if (field && field.options) {
                    field.options.forEach(opt => {
                        if (typeof opt === 'object' && opt.linkedFields) {
                            opt.linkedFields.forEach(lf => {
                                // Only delete if it's NOT the currently selected one's linked field (optimized)
                                // Actually, easiest is to delete ALL potential linked fields for this master field
                                // But wait, if we switch options, we want to clear.
                                // If we just check `getLinkedFields` it returns current valid ones.
                                // So we should verify which keys to keep? 
                                // Let's just blindly delete all possible linked keys for this field to be safe
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
                    formData.append('assignProductID', this.formData.assignProductID);

                    // Complex fields
                    formData.append('specifications', JSON.stringify(this.formData.specifications));
                    formData.append('tags', JSON.stringify(this.formData.tags));

                    // Images
                    this.imageFiles.forEach(file => {
                        formData.append('images', file);
                    });

                    await axios.post('/api/v1/products', formData, {
                        headers: {
                            'Content-Type': 'multipart/form-data',
                            'Authorization': `Bearer ${this.token}`
                        }
                    });

                    window.showNotification('Product added successfully!');
                    setTimeout(() => {
                        window.location.href = '/products';
                    }, 1000);
                } catch (error) {
                    window.showNotification('Error saving product: ' + (error.response?.data?.message || error.message), 'error');
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
