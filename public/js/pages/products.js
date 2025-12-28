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
                isSold: null,
                minPrice: '',
                maxPrice: '',
                specs: {}
            },
            availableFilters: {},
            showViewModal: false,
            showQRModal: false,
            activeImageIndex: 0,
            viewData: {},
            showFilters: true,

            // Pagination
            pagination: {
                page: 1,
                limit: 12,
                totalPages: 1,
                totalItems: 0
            },

            // Import Preview
            showImportPreview: false,
            importPreviewData: null,
            categoryMappings: {},
            sourceMappings: {},
            pendingFile: null,

            // AI Ad Generation (Keep existing logic)
            showAdsModal: false,
            generatingAd: false,
            generatedAds: {
                short: '',
                medium: '',
                long: ''
            },
            copiedMessage: '',

            // Get parent data
            get activeFiltersCount() {
                let count = 0;
                if (this.filters.category) count++;
                if (this.filters.isSold !== null) count++;
                if (this.filters.minPrice || this.filters.maxPrice) count++;

                // Specs count
                Object.values(this.filters.specs).forEach(values => {
                    if (values && values.length > 0) count++;
                });

                return count;
            },

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
            },



            async loadProducts() {
                this.loading = true;
                try {
                    let query = `?page=${this.pagination.page}&limit=${this.pagination.limit}`;

                    if (this.filters.search) query += `&search=${encodeURIComponent(this.filters.search)}`;
                    if (this.filters.category) query += `&category=${this.filters.category}`;
                    if (this.filters.isSold !== null) query += `&isSold=${this.filters.isSold}`;

                    if (this.filters.minPrice) query += `&minPrice=${this.filters.minPrice}`;
                    if (this.filters.maxPrice) query += `&maxPrice=${this.filters.maxPrice}`;

                    // Add spec filters from UI
                    if (Object.keys(this.filters.specs).length > 0) {
                        const specsQuery = {};
                        for (const [key, values] of Object.entries(this.filters.specs)) {
                            if (values && values.length > 0) specsQuery[key] = values;
                        }
                        if (Object.keys(specsQuery).length > 0) {
                            query += `&specs=${encodeURIComponent(JSON.stringify(specsQuery))}`;
                        }
                    }

                    const response = await window.api.get(`/products${query}`);
                    this.products = response.data;

                    // Update pagination from response
                    if (response.pagination) {
                        this.pagination.totalPages = response.pagination.totalPages;
                        this.pagination.totalItems = response.pagination.total;
                        this.pagination.page = response.pagination.page;
                    }

                    this.loadFilters();
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

            async loadFilters() {
                try {
                    let query = '?';
                    if (this.filters.search) query += `search=${this.filters.search}&`;
                    if (this.filters.category) query += `category=${this.filters.category}&`;

                    const response = await window.api.get(`/products/filters${query}`);
                    this.availableFilters = response.data;
                } catch (error) {
                    console.error('Error loading filters:', error);
                }
            },

            toggleFilter(key, value) {
                if (!this.filters.specs[key]) {
                    this.filters.specs[key] = [];
                }
                const index = this.filters.specs[key].indexOf(value);
                if (index === -1) {
                    this.filters.specs[key].push(value);
                } else {
                    this.filters.specs[key].splice(index, 1);
                    if (this.filters.specs[key].length === 0) {
                        delete this.filters.specs[key];
                    }
                }
                this.loadProducts();
            },

            goToPage(page) {
                if (page < 1 || page > this.pagination.totalPages) return;
                this.pagination.page = page;
                this.loadProducts();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            },

            nextPage() {
                if (this.pagination.page < this.pagination.totalPages) {
                    this.pagination.page++;
                    this.loadProducts();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            },

            prevPage() {
                if (this.pagination.page > 1) {
                    this.pagination.page--;
                    this.loadProducts();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            },

            // Reset to page 1 when filters change
            resetAndLoad() {
                this.pagination.page = 1;
                this.loadProducts();
            },

            async loadContacts() {
                try {
                    const response = await window.api.get('/contacts?page=1&limit=100');
                    this.contacts = response.data; // For paginated response, data is in response.data
                } catch (error) {
                    console.error('Error loading contacts:', error);
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

            async viewProduct(product) {
                try {
                    // Fetch fresh product data with populated fields
                    const response = await window.api.get(`/products/${product._id}`);
                    this.viewData = response.data;
                    this.activeImageIndex = 0;

                    // We need the category template to format specifications smartly
                    // The backend populate might have populated 'category' field.
                    // If not, we might need to fetch it or find it in this.categories
                    let categoryTemplate = [];
                    if (this.viewData.category && this.viewData.category.specificationsTemplate) {
                        categoryTemplate = this.viewData.category.specificationsTemplate;
                    } else if (this.viewData.category) {
                        // Likely an ID if not populated fully, or if populated but somehow missing template
                        const catId = typeof this.viewData.category === 'object' ? this.viewData.category._id : this.viewData.category;
                        const category = this.categories.find(c => c._id === catId);
                        if (category) categoryTemplate = category.specificationsTemplate || [];
                    }

                    // Pre-process specifications for display
                    this.viewData.formattedSpecs = this.formatSpecifications(this.viewData.specifications || {}, categoryTemplate);
                    this.showViewModal = true;
                } catch (error) {
                    console.error('Error loading product details:', error);
                    window.showNotification('Error loading product details. Please try again.', 'error');
                }
            },

            closeViewModal() {
                this.showViewModal = false;
                this.viewData = {};
            },

            downloadQR(dataUrl, productID) {
                if (!dataUrl) return;
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = `QR_${productID || 'Asset'}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.showNotification('Artifact QR Downloaded', 'success');
            },

            formatSpecifications(specs, template) {
                if (!specs) return [];

                // If template is empty, map all entries
                if (!template || !template.length) {
                    return Object.entries(specs)
                        .filter(([key, value]) => value && !key.startsWith('_'))
                        .map(([key, value]) => ({ label: key, value }));
                }

                const formatted = [];
                const processedKeys = new Set();

                // 1. Process template fields
                template.forEach(field => {
                    const value = specs[field.fieldName];
                    if (value === undefined || value === null || value === '') return;

                    let displayValue = String(value);
                    processedKeys.add(field.fieldName);

                    // Select logic for linked fields
                    if (field.fieldType === 'select' && field.options) {
                        const selectedOption = field.options.find(opt => (typeof opt === 'string' ? opt : opt.value) === value);
                        if (selectedOption && typeof selectedOption === 'object') {
                            // Sub-options support
                            const subKey = field.fieldName + '_sub';
                            if (specs[subKey]) {
                                displayValue += ` ${specs[subKey]}`;
                                processedKeys.add(subKey);
                            }
                            // Linked fields recursion
                            if (selectedOption.linkedFields) {
                                selectedOption.linkedFields.forEach(lf => {
                                    const lfVal = specs[lf.fieldName];
                                    if (lfVal) {
                                        displayValue += ` ${lfVal}`;
                                        processedKeys.add(lf.fieldName);
                                        displayValue += this.getLinkedValueRecursive(lf, lfVal, specs, processedKeys);
                                    }
                                });
                            }
                        }
                    }

                    formatted.push({ label: field.fieldName, value: displayValue });
                });

                // 2. Add remaining non-metadata fields
                Object.entries(specs).forEach(([key, value]) => {
                    if (!processedKeys.has(key) && !key.endsWith('_sub') && value && !key.startsWith('_') && key !== 'id') {
                        formatted.push({ label: key, value: String(value) });
                    }
                });

                return formatted;
            },

            getLinkedValueRecursive(field, currentValue, specs, processedKeys) {
                let suffix = '';
                if (field.fieldType === 'select' && field.options) {
                    // The linked field definition in the parent option ALREADY contains its options and their linked fields
                    // So `field` here IS the schema definition from the parent's option.linkedFields array.
                    const selectedOption = (field.options || []).find(opt => {
                        const val = typeof opt === 'string' ? opt : opt.value;
                        return val === currentValue;
                    });

                    if (selectedOption && typeof selectedOption === 'object' && selectedOption.linkedFields) {
                        selectedOption.linkedFields.forEach(nextLf => {
                            const nextVal = specs[nextLf.fieldName];
                            if (nextVal) {
                                suffix += ` ${nextVal}`;
                                processedKeys.add(nextLf.fieldName);
                                suffix += this.getLinkedValueRecursive(nextLf, nextVal, specs, processedKeys);
                            }
                        });
                    }
                }
                return suffix;
            },

            editProductFromView() {
                // Close view modal and open edit modal with the current product
                this.closeViewModal();
                // Redirect to edit page
                if (this.viewData && this.viewData._id) {
                    window.location.href = `/products/edit/${this.viewData._id}`;
                }
            },

            async exportProducts(isTemplate = false) {
                try {
                    let query = '';
                    if (isTemplate) {
                        query = `?template=true&category=${this.filters.category}`;
                    } else if (this.filters.category) {
                        query = `?category=${this.filters.category}`;
                    }

                    const response = await window.api.get(`/products/export${query}`, { responseType: 'blob' });
                    // window.api (axios wrapper) returns response.data directly.
                    // If responseType is blob, 'response' IS the blob.
                    const blob = response;
                    const url = window.URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob]));
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', isTemplate ? 'product_template.csv' : 'products.csv');
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                } catch (error) {
                    console.error('Export error:', error);
                    window.showNotification(isTemplate ? 'Error exporting template' : 'Error exporting products', 'error');
                }
            },

            async exportToExcel(applyFilters = false) {
                try {
                    window.showNotification('Preparing Excel Export...', 'info');

                    let url = '/products/export-excel';
                    if (applyFilters) {
                        const params = new URLSearchParams();
                        if (this.filters.category) params.append('category', this.filters.category);
                        if (this.filters.search) params.append('search', this.filters.search);
                        if (this.filters.isSold !== '') params.append('isSold', this.filters.isSold);
                        if (this.filters.minPrice) params.append('minPrice', this.filters.minPrice);
                        if (this.filters.maxPrice) params.append('maxPrice', this.filters.maxPrice);

                        // Handle specs if present
                        if (this.filters.specs && Object.keys(this.filters.specs).length > 0) {
                            params.append('specs', JSON.stringify(this.filters.specs));
                        }

                        const queryString = params.toString();
                        if (queryString) url += '?' + queryString;
                    }

                    const response = await window.api.get(url, { responseType: 'blob' });
                    const blob = response;
                    const urlBlob = window.URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob]));
                    const link = document.createElement('a');
                    link.href = urlBlob;

                    const timestamp = new Date().toISOString().split('T')[0];
                    const fileName = applyFilters ? `Filtered_Inventory_${timestamp}.xlsx` : `Full_Inventory_${timestamp}.xlsx`;

                    link.setAttribute('download', fileName);
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.showNotification('Excel Export Complete!', 'success');
                } catch (error) {
                    console.error('Excel Export error:', error);
                    window.showNotification('Error exporting to Excel', 'error');
                }
            },


            triggerImport() {
                this.$refs.importFile.click();
            },

            async importProducts(event) {
                const file = event.target.files[0];
                if (!file) return;

                this.pendingFile = file;
                const formData = new FormData();
                formData.append('file', file);

                console.log('DEBUG: Importing file:', file.name, file.size, file.type);
                // Log FormData entries
                for (let pair of formData.entries()) {
                    console.log('DEBUG FormData:', pair[0], pair[1]);
                }

                try {
                    window.showNotification('Analyzing CSV...', 'info');
                    const response = await window.api.post('/products/import/preview', formData);

                    console.log('DEBUG: Preview response:', response);

                    this.importPreviewData = response;

                    // Initialize mappings with existing matches
                    this.categoryMappings = { ...response.categoryMatches };
                    this.sourceMappings = { ...response.sourceMatches };

                    // For missing categories, initialize with CREATE: prefix
                    response.missingCategories.forEach(cat => {
                        this.categoryMappings[cat] = `CREATE:${cat}`;
                    });

                    // For missing sources, initialize with CREATE: prefix
                    response.missingSources.forEach(src => {
                        this.sourceMappings[src] = `CREATE:${src}:0000000000:Supplier`;
                    });

                    this.showImportPreview = true;

                    // Auto-confirm if everything is matched (no missing categories/sources)
                    if (response.missingCategories.length === 0 && response.missingSources.length === 0) {
                        window.showNotification('All categories and sources matched! Proceeding with import...', 'success');
                        setTimeout(() => this.confirmImport(), 1000);
                    }
                } catch (error) {
                    console.error('Import preview error:', error);
                    window.showNotification(error.response?.data?.message || 'Error analyzing CSV', 'error');
                }

                // Reset input
                event.target.value = '';
            },

            async confirmImport() {
                if (!this.pendingFile) return;

                const formData = new FormData();
                formData.append('file', this.pendingFile);
                formData.append('categoryMappings', JSON.stringify(this.categoryMappings));
                formData.append('sourceMappings', JSON.stringify(this.sourceMappings));

                try {
                    window.showNotification('Importing products...', 'info');
                    const response = await window.api.post('/products/import', formData);

                    window.showNotification(`Successfully imported ${response.importedCount} products!`, 'success');

                    if (response.errors && response.errors.length > 0) {
                        alert(`Import completed with warnings:\n${response.errors.join('\n')}`);
                    }

                    this.loadProducts();
                    this.closeImportPreview();
                } catch (error) {
                    console.error('Import error:', error);
                    window.showNotification(error.response?.data?.message || 'Error importing products', 'error');
                }
            },

            updateSourceMapping(srcName, field, value) {
                const parts = this.sourceMappings[srcName].replace('CREATE:', '').split(':');
                if (field === 'name') parts[0] = value;
                if (field === 'phone') parts[1] = value;
                if (field === 'type') parts[2] = value;
                this.sourceMappings[srcName] = `CREATE:${parts.join(':')}`;
            },

            closeImportPreview() {
                this.showImportPreview = false;
                this.importPreviewData = null;
                this.categoryMappings = {};
                this.sourceMappings = {};
                this.pendingFile = null;
            },

            // AI Ad Generation Functions
            async generateAd(productId) {
                this.generatingAd = true;
                try {
                    const response = await window.api.post('/ai/generate-product-ad', { productId });
                    this.generatedAds = response.data.messages;
                    this.showAdsModal = true;
                } catch (error) {
                    console.error('Error generating ad:', error);
                    if (error.response?.data?.code === 'AI_NOT_CONFIGURED') {
                        window.showNotification('AI is not configured. Please set up AI in Settings first.', 'error');
                    } else if (error.response?.data?.code === 'INVALID_API_KEY') {
                        window.showNotification('Invalid API key. Please check your AI settings.', 'error');
                    } else {
                        window.showNotification('Failed to generate ad: ' + (error.response?.data?.message || error.message), 'error');
                    }
                } finally {
                    this.generatingAd = false;
                }
            },

            closeAdsModal() {
                this.showAdsModal = false;
                this.copiedMessage = '';
            },

            async copyToClipboard(text, messageType) {
                try {
                    await navigator.clipboard.writeText(text);
                    this.copiedMessage = messageType;
                    window.showNotification('Message copied to clipboard!', 'success');
                    // Reset after 2 seconds
                    setTimeout(() => {
                        this.copiedMessage = '';
                    }, 2000);
                } catch (error) {
                    console.error('Failed to copy:', error);
                    window.showNotification('Failed to copy message', 'error');
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
