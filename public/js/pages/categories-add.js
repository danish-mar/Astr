(function () {
    const initComponent = () => {
        Alpine.data('categoryAddData', () => ({
            saving: false,
            formData: {
                name: '',
                description: '',
                specificationsTemplate: []
            },

            get token() { return window.api.token; },

            init() {
                if (!this.token) {
                    window.location.href = '/login';
                    return;
                }

                // Initialize Sortable for Specifications
                this.$nextTick(() => {
                    this.initSortable();
                });
            },

            initSortable() {
                const el = document.getElementById('specifications-container');
                if (el) {
                    new Sortable(el, {
                        animation: 150,
                        handle: '.handle',
                        ghostClass: 'bg-blue-50',
                        onEnd: (evt) => {
                            const item = this.formData.specificationsTemplate.splice(evt.oldIndex, 1)[0];
                            this.formData.specificationsTemplate.splice(evt.newIndex, 0, item);
                        }
                    });
                }

                // Initialize Sortable for Options (Dynamic)
                // We need to re-init this whenever options are rendered, but for now let's try a simpler approach
                // or just rely on the user adding fields. 
                // Since options are inside x-for, we might need to init individual containers.
                // A better way is to use a directive or just init on mouseenter of the parent?
                // Let's rely on Alpine's x-init on the container if possible?
                // Or verify on addSpecField we might wait for render.
            },

            // Helper to init options sortable when a field is added or rendered
            initOptionSortable(elementIndex) {
                // This function can be called from x-init on the options container in HTML
                const containerId = `options-container-${elementIndex}`; // We need to add ID in HTML
                // ... implementation pending HTML update logic, checking plan ...
                // Plan said "Initialize Sortable on the options container".
                // I'll add a specific method I can call from x-init
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

            addSpecField() {
                this.formData.specificationsTemplate.push({
                    id: Date.now() + Math.random().toString(36).substr(2, 9),
                    fieldName: '',
                    fieldType: 'text',
                    required: false,
                    options: []
                });
                // Sortable for main list is already init.
            },

            removeSpecField(index) {
                this.formData.specificationsTemplate.splice(index, 1);
            },

            addOption(fieldIndex) {
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
                    await window.api.post('/categories', payload);
                    window.showNotification('Category created successfully');
                    // Redirect back to categories list
                    setTimeout(() => {
                        window.location.href = '/categories';
                    }, 1000);
                } catch (error) {
                    window.showNotification('Error saving category: ' + (error.response?.data?.message || error.message), 'error');
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
