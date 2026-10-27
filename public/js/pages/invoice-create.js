function invoiceCreateData() {
    return {
        docType: 'Invoice',
        isEditing: false,
        editDocId: null,
        contacts: [],
        tickets: [],
        availableProducts: [],
        accounts: [],
        shopSettings: {
            state: '',
            defaultGstRate: 18,
            invoicePrefix: 'INV-',
            invoiceNextNumber: 1001,
            quotationPrefix: 'QTN-',
            quotationNextNumber: 1001,
            invoiceTerms: '',
        },
        saving: false,
        errors: {},

        hasError(key) {
            return !!this.errors[key];
        },

        getError(key) {
            return this.errors[key] || '';
        },

        clearError(key) {
            if (this.errors[key]) {
                delete this.errors[key];
            }
        },

        form: {
            docNumber: '',
            issueDate: new Date().toISOString().split('T')[0],
            dueDate: '',
            customerId: '',
            customerName: '',
            customerPhone: '',
            customerAddress: '',
            customerGstin: '',
            customerState: '',
            serviceTicketId: '',
            items: [
                {
                    itemType: 'custom',
                    product: '',
                    description: '',
                    hsnSac: '',
                    quantity: 1,
                    unitPrice: 0,
                    discountPercent: 0,
                    taxableAmount: 0,
                    gstRate: 18,
                    cgstAmount: 0,
                    sgstAmount: 0,
                    igstAmount: 0,
                    total: 0,
                },
            ],
            notes: '',
            terms: '',
            hasInitialPayment: false,
            initialPayment: {
                amount: 0,
                paymentMode: 'Cash',
                accountId: '',
            },
        },

        totals: {
            subtotal: 0,
            totalDiscount: 0,
            taxableTotal: 0,
            cgstTotal: 0,
            sgstTotal: 0,
            igstTotal: 0,
            taxTotal: 0,
            roundOff: 0,
            grandTotal: 0,
        },

        get isInterState() {
            const sState = (this.shopSettings.state || '').trim().toLowerCase();
            const cState = (this.form.customerState || '').trim().toLowerCase();
            return sState !== '' && cState !== '' && sState !== cState;
        },

        async init() {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('type') === 'Quotation') {
                this.docType = 'Quotation';
            }

            // Keyboard shortcut for Cmd+S / Ctrl+S
            window.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    this.saveDocument();
                }
            });

            // Check if editing existing document: /invoices/:id/edit or ?edit=:id
            const pathParts = window.location.pathname.split('/').filter(Boolean);
            let editId = null;
            if (pathParts.length >= 2 && pathParts[pathParts.length - 1] === 'edit') {
                editId = pathParts[pathParts.length - 2];
            } else if (urlParams.get('edit')) {
                editId = urlParams.get('edit');
            }

            await this.loadDependencies();

            if (editId) {
                this.isEditing = true;
                this.editDocId = editId;
                await this.loadExistingDocument(editId);
            } else {
                await this.fetchNextNumber();

                const prefillTicketId = urlParams.get('serviceTicketId');
                const prefillCustomerId = urlParams.get('customer');

                if (prefillTicketId) {
                    await this.loadAndApplyServiceTicket(prefillTicketId, prefillCustomerId);
                } else if (prefillCustomerId) {
                    this.form.customerId = prefillCustomerId;
                    this.onCustomerSelected();
                }
            }

            this.recalculate();
        },

        async loadExistingDocument(id) {
            try {
                const res = await Alpine.store('app').api(`/invoices/${id}`);
                if (res.success && res.data?.invoice) {
                    const inv = res.data.invoice;
                    this.docType = inv.docType;
                    this.form.docNumber = inv.docNumber;
                    this.form.customerId = inv.customer?._id || inv.customer;
                    this.form.customerName = inv.customerName;
                    this.form.customerPhone = inv.customerPhone || '';
                    this.form.customerAddress = inv.customerAddress || '';
                    this.form.customerGstin = inv.customerGstin || '';
                    this.form.customerState = inv.customerState || '';
                    this.form.serviceTicketId = inv.serviceTicket?._id || inv.serviceTicket || '';
                    this.form.issueDate = inv.issueDate ? new Date(inv.issueDate).toISOString().split('T')[0] : '';
                    this.form.dueDate = inv.dueDate ? new Date(inv.dueDate).toISOString().split('T')[0] : '';
                    this.form.notes = inv.notes || '';
                    this.form.terms = inv.terms || '';

                    if (inv.items && inv.items.length > 0) {
                        this.form.items = inv.items.map(itm => ({
                            itemType: itm.itemType || 'custom',
                            product: itm.product?._id || itm.product || '',
                            description: itm.description,
                            hsnSac: itm.hsnSac || '',
                            quantity: itm.quantity,
                            unitPrice: itm.unitPrice,
                            discountPercent: itm.discountPercent || 0,
                            taxableAmount: itm.taxableAmount,
                            gstRate: itm.gstRate || 0,
                            cgstAmount: itm.cgstAmount || 0,
                            sgstAmount: itm.sgstAmount || 0,
                            igstAmount: itm.igstAmount || 0,
                            total: itm.total
                        }));
                    }
                }
            } catch (err) {
                console.error('Failed to load existing document for edit:', err);
                window.showNotification('Failed to load document for editing', 'error');
            }
        },

        async loadDependencies() {
            try {
                const [setRes, conRes, prodRes, tickRes, accRes] = await Promise.all([
                    Alpine.store('app').api('/settings'),
                    Alpine.store('app').api('/contacts?limit=200'),
                    Alpine.store('app').api('/products?isSold=false&limit=100'),
                    Alpine.store('app').api('/service-tickets?status=Pending,In Progress,Completed,Delivered&limit=100'),
                    Alpine.store('app').api('/accounting/accounts'),
                ]);

                if (setRes.success && setRes.data?.settings) {
                    this.shopSettings = setRes.data.settings;
                    if (this.shopSettings.invoiceTerms) {
                        this.form.terms = this.shopSettings.invoiceTerms;
                    }
                    if (this.shopSettings.defaultGstRate !== undefined && this.form.items[0]) {
                        this.form.items[0].gstRate = Number(this.shopSettings.defaultGstRate);
                    }
                }

                if (conRes.success) {
                    this.contacts = conRes.data || [];
                }

                if (prodRes.success) {
                    this.availableProducts = prodRes.data || [];
                }

                if (tickRes.success) {
                    this.tickets = tickRes.data || [];
                }

                if (accRes.success) {
                    this.accounts = accRes.data || [];
                    if (this.accounts.length > 0) {
                        this.form.initialPayment.accountId = this.accounts[0]._id;
                    }
                }
            } catch (err) {
                console.error('Failed to load dependencies:', err);
            }
        },

        async fetchNextNumber() {
            try {
                const res = await Alpine.store('app').api(`/invoices/next-number?type=${this.docType}`);
                if (res.success && res.data?.formattedNumber) {
                    this.form.docNumber = res.data.formattedNumber;
                }
            } catch (err) {
                console.error('Failed to get next number:', err);
            }
        },

        setDocType(type) {
            if (this.docType !== type) {
                this.docType = type;
                this.fetchNextNumber();
            }
        },

        onCustomerSelected() {
            const customer = this.contacts.find((c) => c._id === this.form.customerId);
            if (customer) {
                this.form.customerName = customer.name;
                this.form.customerPhone = customer.phone || '';
                this.form.customerAddress = customer.address || '';
                this.form.customerGstin = customer.gstin || '';
                this.form.customerState = customer.state || this.shopSettings.state || '';
                this.recalculate();
            }
        },

        async loadAndApplyServiceTicket(ticketId, fallbackCustomerId = null) {
            try {
                let ticket = this.tickets.find((t) => t._id === ticketId);
                if (!ticket) {
                    const res = await Alpine.store('app').api(`/service-tickets/${ticketId}`);
                    if (res && res.success && res.data) {
                        ticket = res.data;
                        this.tickets.unshift(ticket);
                    }
                }

                if (!ticket) return;

                this.form.serviceTicketId = ticket._id;
                this.applyTicketData(ticket, fallbackCustomerId);
            } catch (err) {
                console.error('Failed to prefill service ticket:', err);
            }
        },

        onTicketSelected() {
            const ticket = this.tickets.find((t) => t._id === this.form.serviceTicketId);
            if (ticket) {
                this.applyTicketData(ticket);
            }
        },

        applyTicketData(ticket, fallbackCustomerId = null) {
            if (!ticket) return;

            // 1. Customer Population
            const cust = ticket.customer;
            const custId = (cust && typeof cust === 'object') ? cust._id : (cust || fallbackCustomerId);

            if (custId) {
                this.form.customerId = custId;
                if (cust && typeof cust === 'object') {
                    if (!this.contacts.some((c) => c._id === cust._id)) {
                        this.contacts.unshift(cust);
                    }
                    this.form.customerName = cust.name || '';
                    this.form.customerPhone = cust.phone || '';
                    this.form.customerAddress = cust.address || '';
                    this.form.customerGstin = cust.gstin || '';
                    this.form.customerState = cust.state || this.shopSettings.state || '';
                } else {
                    this.onCustomerSelected();
                }
            }

            // 2. Repair Service & Work Done Line Item
            const charge = ticket.serviceCharge || 0;
            let desc = `Repair Service: ${ticket.deviceDetails || 'Hardware Repair'} (Ticket #${ticket.ticketNumber})`;
            if (ticket.notes && ticket.notes.trim()) {
                desc += ` - ${ticket.notes.trim()}`;
            }

            const defaultGst = Number(this.shopSettings.defaultGstRate !== undefined ? this.shopSettings.defaultGstRate : 18);

            if (this.form.items.length === 1 && (!this.form.items[0].description || this.form.items[0].description === '')) {
                this.form.items[0].description = desc;
                this.form.items[0].unitPrice = charge;
                this.form.items[0].hsnSac = '9987';
                this.form.items[0].itemType = 'service';
                this.form.items[0].gstRate = defaultGst;
                this.form.items[0].quantity = 1;
                this.form.items[0].total = charge;
            } else {
                this.form.items.push({
                    itemType: 'service',
                    product: '',
                    description: desc,
                    hsnSac: '9987',
                    quantity: 1,
                    unitPrice: charge,
                    discountPercent: 0,
                    taxableAmount: charge,
                    gstRate: defaultGst,
                    cgstAmount: 0,
                    sgstAmount: 0,
                    igstAmount: 0,
                    total: charge,
                });
            }

            // 3. Invoice Notes
            if (!this.form.notes && (ticket.deviceDetails || ticket.notes)) {
                this.form.notes = `Service Ticket #${ticket.ticketNumber} [${ticket.deviceDetails}]${ticket.notes ? ': ' + ticket.notes : ''}`;
            }

            this.recalculate();
        },

        addItemRow(type = 'custom') {
            const defaultRate = Number(this.shopSettings.defaultGstRate !== undefined ? this.shopSettings.defaultGstRate : 18);
            this.form.items.push({
                itemType: type,
                product: '',
                description: '',
                hsnSac: type === 'product' ? '8471' : '9987',
                quantity: 1,
                unitPrice: 0,
                discountPercent: 0,
                taxableAmount: 0,
                gstRate: defaultRate,
                cgstAmount: 0,
                sgstAmount: 0,
                igstAmount: 0,
                total: 0,
            });
            this.recalculate();
        },

        onProductRowSelect(row) {
            const p = this.availableProducts.find((item) => item._id === row.product);
            if (p) {
                row.description = p.name;
                row.unitPrice = Number(p.price || 0);
                row.hsnSac = '8471';
                this.recalculate();
            }
        },

        removeRow(index) {
            if (this.form.items.length > 1) {
                this.form.items.splice(index, 1);
                this.recalculate();
            }
        },

        recalculate() {
            let sub = 0;
            let disc = 0;
            let taxTot = 0;
            let cgst = 0;
            let sgst = 0;
            let igst = 0;

            const isInter = this.isInterState;

            this.form.items.forEach((item) => {
                const qty = Math.max(0.01, Number(item.quantity) || 1);
                const rate = Math.max(0, Number(item.unitPrice) || 0);
                const discountPct = Math.min(100, Math.max(0, Number(item.discountPercent) || 0));
                const gstRate = Math.max(0, Number(item.gstRate) || 0);

                const lineGross = qty * rate;
                const lineDiscount = Number(((lineGross * discountPct) / 100).toFixed(2));
                const taxable = Number(Math.max(0, lineGross - lineDiscount).toFixed(2));

                let lineCgst = 0;
                let lineSgst = 0;
                let lineIgst = 0;

                if (gstRate > 0) {
                    if (isInter) {
                        lineIgst = Number(((taxable * gstRate) / 100).toFixed(2));
                    } else {
                        const half = gstRate / 2;
                        lineCgst = Number(((taxable * half) / 100).toFixed(2));
                        lineSgst = Number(((taxable * half) / 100).toFixed(2));
                    }
                }

                item.taxableAmount = taxable;
                item.cgstAmount = lineCgst;
                item.sgstAmount = lineSgst;
                item.igstAmount = lineIgst;
                item.total = Number((taxable + lineCgst + lineSgst + lineIgst).toFixed(2));

                sub += lineGross;
                disc += lineDiscount;
                taxTot += taxable;
                cgst += lineCgst;
                sgst += lineSgst;
                igst += lineIgst;
            });

            const totalTaxLiability = Number((cgst + sgst + igst).toFixed(2));
            const rawGrand = taxTot + totalTaxLiability;
            const finalGrand = Math.round(rawGrand);
            const rOff = Number((finalGrand - rawGrand).toFixed(2));

            this.totals = {
                subtotal: Number(sub.toFixed(2)),
                totalDiscount: Number(disc.toFixed(2)),
                taxableTotal: Number(taxTot.toFixed(2)),
                cgstTotal: Number(cgst.toFixed(2)),
                sgstTotal: Number(sgst.toFixed(2)),
                igstTotal: Number(igst.toFixed(2)),
                taxTotal: totalTaxLiability,
                roundOff: rOff,
                grandTotal: finalGrand,
            };

            // Pre-fill initial payment amount with grand total if checked
            if (this.form.hasInitialPayment && (!this.form.initialPayment.amount || this.form.initialPayment.amount === 0)) {
                this.form.initialPayment.amount = finalGrand;
            }
        },

        validateForm() {
            this.errors = {};

            if (!this.form.customerId) {
                this.errors['customerId'] = 'Please select a customer / party';
            }

            if (!this.form.docNumber || !this.form.docNumber.trim()) {
                this.errors['docNumber'] = 'Document number cannot be empty';
            }

            if (!this.form.items || this.form.items.length === 0) {
                this.errors['items'] = 'At least one line item is required';
            } else {
                this.form.items.forEach((item, idx) => {
                    if (!item.description || !item.description.trim()) {
                        this.errors[`items.${idx}.description`] = 'Please enter product name or description';
                    }
                    if (item.quantity === null || item.quantity === undefined || Number(item.quantity) <= 0) {
                        this.errors[`items.${idx}.quantity`] = 'Qty must be > 0';
                    }
                    if (item.unitPrice === null || item.unitPrice === undefined || Number(item.unitPrice) < 0) {
                        this.errors[`items.${idx}.unitPrice`] = 'Rate cannot be negative';
                    }
                });
            }

            if (this.docType === 'Invoice' && this.form.hasInitialPayment) {
                const amt = Number(this.form.initialPayment.amount);
                if (isNaN(amt) || amt <= 0) {
                    this.errors['initialPayment.amount'] = 'Enter amount greater than 0';
                } else if (amt > this.totals.grandTotal) {
                    this.errors['initialPayment.amount'] = 'Payment cannot exceed Grand Total';
                }
            }

            const errorKeys = Object.keys(this.errors);
            if (errorKeys.length > 0) {
                const firstMsg = this.errors[errorKeys[0]];
                window.showNotification(firstMsg, 'error');

                setTimeout(() => {
                    const firstEl = document.querySelector('.has-field-error');
                    if (firstEl) {
                        firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        firstEl.focus();
                    }
                }, 80);

                return false;
            }

            return true;
        },

        async saveDocument() {
            if (!this.validateForm()) {
                return;
            }

            this.saving = true;
            try {
                const payload = {
                    docType: this.docType,
                    docNumber: this.form.docNumber,
                    customerId: this.form.customerId,
                    customerName: this.form.customerName,
                    customerPhone: this.form.customerPhone,
                    customerAddress: this.form.customerAddress,
                    customerGstin: this.form.customerGstin,
                    customerState: this.form.customerState,
                    serviceTicketId: this.form.serviceTicketId || undefined,
                    items: this.form.items.map((i) => ({
                        itemType: i.itemType,
                        product: i.product || undefined,
                        description: i.description,
                        hsnSac: i.hsnSac,
                        quantity: i.quantity,
                        unitPrice: i.unitPrice,
                        discountPercent: i.discountPercent,
                        gstRate: i.gstRate,
                    })),
                    issueDate: this.form.issueDate,
                    dueDate: this.form.dueDate || undefined,
                    notes: this.form.notes,
                    terms: this.form.terms,
                    initialPayment:
                        this.docType === 'Invoice' && this.form.hasInitialPayment && this.form.initialPayment.amount > 0
                            ? {
                                  amount: this.form.initialPayment.amount,
                                  paymentMode: this.form.initialPayment.paymentMode,
                                  accountId: this.form.initialPayment.accountId || undefined,
                                  reference: this.form.docNumber,
                              }
                            : undefined,
                };

                let res;
                if (this.isEditing) {
                    res = await Alpine.store('app').api(`/invoices/${this.editDocId}`, 'PUT', payload);
                } else {
                    res = await Alpine.store('app').api('/invoices', 'POST', payload);
                }

                if (res.success && res.data) {
                    const targetId = this.isEditing ? this.editDocId : res.data._id;
                    window.showNotification(`${this.docType} ${this.isEditing ? 'updated' : 'generated'} successfully!`, 'success');
                    window.location.href = `/invoices/${targetId}`;
                }
            } catch (err) {
                console.error('Save document error:', err);
                const msg = err.response?.data?.message || err.message || 'Failed to save document';
                window.showNotification(msg, 'error');

                const lowerMsg = msg.toLowerCase();
                if (lowerMsg.includes('customer')) {
                    this.errors['customerId'] = msg;
                } else if (lowerMsg.includes('item') || lowerMsg.includes('description')) {
                    this.errors['items.0.description'] = msg;
                } else if (lowerMsg.includes('number') || lowerMsg.includes('already exists')) {
                    this.errors['docNumber'] = msg;
                }
            } finally {
                this.saving = false;
            }
        },

        formatNumber(val) {
            return Number(val || 0).toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
        },
    };
}
