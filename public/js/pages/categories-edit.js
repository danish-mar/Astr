(function () {
    const initComponent = () => {
        Alpine.data('categoryEditData', () => ({
            saving: false,
            loading: true,
            categoryId: null,
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

                const pathParts = window.location.pathname.split('/');
                this.categoryId = pathParts[pathParts.length - 1];

                if (this.categoryId) {
                    await this.loadCategory();
                }

                // Initialize Sortable for Specifications (Wait for render)
                this.$nextTick(() => {
                    this.initSortable();
                    // Options sortable is handled by x-init in HTML
                });
            },

            initSortable() {
                const el = document.getElementById('specifications-container');
                if (el) {
                    new Sortable(el, {
                        animation: 150,
                        handle: '.handle',
                        draggable: '.draggable-item',
                        ghostClass: 'bg-blue-50',
                        onEnd: (evt) => {
                            const item = this.formData.specificationsTemplate.splice(evt.oldIndex, 1)[0];
                            this.formData.specificationsTemplate.splice(evt.newIndex, 0, item);
                        }
                    });
                }
            },

            initOptionsSortable(el, fieldIndex) {
                new Sortable(el, {
                    animation: 150,
                    handle: '.option-handle',
                    ghostClass: 'bg-blue-50',
                    onEnd: (evt) => {
                        const item = this.formData.specificationsTemplate[fieldIndex].options.splice(evt.oldIndex, 1)[0];
                        this.formData.specificationsTemplate[fieldIndex].options.splice(evt.newIndex, 0, item);
                    }
                });
            },

            async loadCategory() {
                try {
                    const response = await window.api.get(`/categories/${this.categoryId}`);
                    const category = response.data;

                    // Populate form data
                    this.formData = {
                        name: category.name,
                        description: category.description || '',
                        specificationsTemplate: category.specificationsTemplate.map(field => {
                            // Ensure options have proper structure for builder
                            const processedField = { ...field, id: field.id || (Date.now() + Math.random().toString(36).substr(2, 9)) };

                            if (processedField.fieldType === 'select' && processedField.options) {
                                processedField.options = processedField.options.map(opt => {
                                    // Make sure linkedFields have _tempOptions if select type
                                    if (typeof opt === 'string') {
                                        return { value: opt, subOptions: [], linkedFields: [] };
                                    }
                                    const linkedFields = (opt.linkedFields || []).map(lf => {
                                        if (lf.fieldType === 'select' && lf.options) {
                                            lf._tempOptions = lf.options.join(', ');
                                        }
                                        return lf;
                                    });

                                    return {
                                        ...opt,
                                        subOptions: opt.subOptions || [],
                                        linkedFields: linkedFields
                                    };
                                });
                            }
                            return processedField;
                        })
                    };
                    this.loading = false;
                } catch (error) {
                    window.showNotification('Error loading category: ' + (error.response?.data?.message || error.message), 'error');
                    this.loading = false;
                }
            },

            addSpecField() {
                this.formData.specificationsTemplate.push({
                    id: Date.now() + Math.random().toString(36).substr(2, 9),
                    fieldName: '',
                    fieldType: 'text',
                    required: false,
                    options: []
                });
            },

            removeSpecField(index) {
                this.formData.specificationsTemplate.splice(index, 1);
            },

            addOption(fieldIndex) {
                // Ensure array exists
                if (!this.formData.specificationsTemplate[fieldIndex].options) {
                    this.formData.specificationsTemplate[fieldIndex].options = [];
                }
                this.formData.specificationsTemplate[fieldIndex].options.push({
                    value: '',
                    subOptions: []
                });
            },

            removeOption(fieldIndex, optionIndex) {
                this.formData.specificationsTemplate[fieldIndex].options.splice(optionIndex, 1);
            },

            addSubOption(option, inputEl) {
                const val = inputEl.value.trim();
                if (val) {
                    if (!option.subOptions) option.subOptions = [];
                    // Prevent duplicates
                    if (!option.subOptions.includes(val)) {
                        option.subOptions.push(val);
                    }
                    inputEl.value = '';
                }
            },

            addLinkedField(option) {
                if (!option.linkedFields) option.linkedFields = [];
                option.linkedFields.push({
                    fieldName: '',
                    fieldType: 'text',
                    required: false,
                    options: [],
                    _tempOptions: '' // Helper for UI input
                });
            },

            processLinkedOptions(linkedField) {
                if (linkedField._tempOptions && linkedField.fieldType === 'select') {
                    // Split comma separated string into options array
                    linkedField.options = linkedField._tempOptions.split(',').map(s => s.trim()).filter(s => s);
                }
            },

            async saveCategory() {
                if (!this.formData.name) {
                    window.showNotification('Category name is required', 'error');
                    return;
                }

                // Process options for select fields
                const processedTemplate = this.formData.specificationsTemplate.map(field => {
                    const newField = { ...field };
                    if (field.fieldType === 'select') {
                        // Filter out empty options
                        newField.options = (field.options || [])
                            .filter(o => o.value && o.value.trim())
                            .map(o => {
                                // Process linked fields logic recursively or flat?
                                // Schema allows nested structure. Let's clean it up.
                                const linkedFields = (o.linkedFields || []).map(lf => {
                                    // Make sure options are processed if not done by blur
                                    if (lf._tempOptions && (!lf.options || lf.options.length === 0)) {
                                        lf.options = lf._tempOptions.split(',').map(s => s.trim()).filter(s => s);
                                    }
                                    const { _tempOptions, ...cleanLf } = lf; // Remove UI helper
                                    if (cleanLf.fieldType !== 'select') delete cleanLf.options;
                                    return cleanLf;
                                });

                                return {
                                    value: o.value.trim(),
                                    subOptions: o.subOptions,
                                    linkedFields: linkedFields.length ? linkedFields : undefined
                                };
                            });
                    } else {
                        delete newField.options;
                    }
                    return newField;
                });

                const payload = {
                    ...this.formData,
                    specificationsTemplate: processedTemplate
                };

                this.saving = true;
                try {
                    await window.api.put(`/categories/${this.categoryId}`, payload);
                    window.showNotification('Category updated successfully');
                    setTimeout(() => {
                        window.location.href = '/categories';
                    }, 1000);
                } catch (error) {
                    window.showNotification('Error updating category: ' + (error.response?.data?.message || error.message), 'error');
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
