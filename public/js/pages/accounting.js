(function () {
    const initComponent = () => {
        Alpine.data('accountingData', () => ({
            summary: {
                totalPayable: 0,
                totalReceivable: 0,
                netBalance: 0
            },
            accounts: [],
            contacts: [],
            tags: [],
            selectedAccount: null,
            ledgerTransactions: [],
            periodStats: null,
            searchQuery: '',
            visibleAccountLimit: 40,
            loading: false,
            filter: {
                startDate: '',
                endDate: '',
                preset: 'all'
            },
            mobileTab: 'ledger', // 'ledger' | 'accounts' | 'statement'
            selectedType: 'All', // 'All' | 'Customer' | 'Vendor'
            isGeneralLedger: true,
            modals: {
                addAccount: false,
                addTransaction: false,
                manageTags: false
            },
            editMode: {
                account: false,
                transaction: false
            },
            // Searchable Combobox State for Voucher Modal
            txAccountSearch: '',
            txAccountDropdownOpen: false,

            // Searchable Combobox State for Add Account Modal
            accountContactSearch: '',
            accountContactDropdownOpen: false,
            contactSearchResults: [],
            isSearchingContacts: false,

            newTag: {
                name: '',
                color: '#7c3aed'
            },
            newAccount: {
                _id: '',
                contactId: '',
                accountType: 'Receivable',
                accountName: ''
            },
            newTx: {
                _id: '',
                accountId: '',
                amount: '',
                transactionType: 'Credit',
                date: new Date().toISOString().split('T')[0],
                tagId: '',
                description: '',
                reference: ''
            },

            async init() {
                this.loading = true;
                try {
                    await Promise.all([
                        this.loadSummary(),
                        this.loadAccounts(),
                        this.loadContacts(),
                        this.loadTags()
                    ]);

                    const urlParams = new URLSearchParams(window.location.search);
                    const targetContactId = urlParams.get('contactId');
                    const targetAccountId = urlParams.get('accountId');
                    const filterType = urlParams.get('type');

                    if (filterType) this.selectedType = filterType;

                    if (targetAccountId) {
                        const match = this.accounts.find(a => a._id === targetAccountId);
                        if (match) {
                            await this.selectAccount(match);
                            return;
                        }
                    } else if (targetContactId) {
                        const match = this.accounts.find(a => (a.contact?._id || a.contact) === targetContactId);
                        if (match) {
                            await this.selectAccount(match);
                            return;
                        }
                    }

                    // Default to General Ledger
                    await this.selectGeneralLedger();
                } catch (err) {
                    console.error('Accounting init error:', err);
                } finally {
                    this.loading = false;
                }
            },

            // Computed
            get filteredAccounts() {
                let list = this.accounts || [];
                if (this.selectedType === 'Customer') {
                    list = list.filter(a => a.accountType === 'Receivable' || a.contact?.contactType === 'Customer');
                } else if (this.selectedType === 'Vendor') {
                    list = list.filter(a => a.accountType === 'Payable' || a.contact?.contactType === 'Vendor' || a.contact?.contactType === 'Supplier');
                }
                if (!this.searchQuery) return list;
                const q = this.searchQuery.toLowerCase().trim();
                return list.filter(a =>
                    (a.accountName || '').toLowerCase().includes(q) ||
                    (a.contact?.name || '').toLowerCase().includes(q) ||
                    (a.contact?.companyName || '').toLowerCase().includes(q) ||
                    (a.contact?.phone || '').includes(q)
                );
            },

            get displayedAccounts() {
                return this.filteredAccounts.slice(0, this.visibleAccountLimit);
            },

            loadMoreAccounts() {
                this.visibleAccountLimit += 40;
            },

            // Combobox Computed for Voucher Modal
            get filteredTxAccounts() {
                const list = this.accounts || [];
                if (!this.txAccountSearch || !this.txAccountSearch.trim()) {
                    return list.slice(0, 25);
                }
                const q = this.txAccountSearch.toLowerCase().trim();
                return list.filter(a =>
                    (a.accountName || '').toLowerCase().includes(q) ||
                    (a.contact?.name || '').toLowerCase().includes(q) ||
                    (a.contact?.phone || '').includes(q) ||
                    (a.contact?.companyName || '').toLowerCase().includes(q)
                ).slice(0, 25);
            },

            get selectedTxAccount() {
                return this.accounts.find(a => a._id === this.newTx.accountId) || null;
            },

            selectTxAccount(acc) {
                if (!acc) {
                    this.newTx.accountId = '';
                    this.txAccountSearch = '';
                    this.txAccountDropdownOpen = false;
                    return;
                }
                this.newTx.accountId = acc._id;
                this.txAccountSearch = acc.accountName;
                this.txAccountDropdownOpen = false;
            },

            // Combobox Methods for Add Account Modal
            async searchAccountContacts() {
                if (!this.accountContactSearch || this.accountContactSearch.trim().length < 2) {
                    this.contactSearchResults = (this.contacts || []).slice(0, 15);
                    return;
                }
                this.isSearchingContacts = true;
                try {
                    const q = encodeURIComponent(this.accountContactSearch.trim());
                    const res = await window.api.get(`/contacts?search=${q}&limit=15`);
                    this.contactSearchResults = res.data || [];
                } catch (e) {
                    console.error('Contact search error:', e);
                    this.contactSearchResults = [];
                } finally {
                    this.isSearchingContacts = false;
                }
            },

            selectAccountContact(contact) {
                if (!contact) {
                    this.newAccount.contactId = '';
                    this.accountContactSearch = '';
                    this.accountContactDropdownOpen = false;
                    return;
                }
                this.newAccount.contactId = contact._id;
                this.accountContactSearch = contact.name + (contact.companyName ? ` (${contact.companyName})` : '');
                this.accountContactDropdownOpen = false;
                if (!this.editMode.account) {
                    this.newAccount.accountName = `${contact.name}'s Service Ledger`;
                    this.newAccount.accountType = contact.contactType === 'Customer' ? 'Receivable' : 'Payable';
                }
            },

            get isTxValid() {
                return !!this.newTx.accountId && Number(this.newTx.amount) > 0;
            },

            // API Loaders
            async loadSummary() {
                try {
                    const res = await window.api.get('/accounting/summary');
                    if (res && res.data) {
                        this.summary = res.data;
                    }
                } catch (e) {
                    console.error('Failed to load summary:', e);
                }
            },

            async loadAccounts() {
                try {
                    const res = await window.api.get('/accounting/accounts');
                    this.accounts = res.data || [];
                } catch (e) {
                    console.error('Failed to load accounts:', e);
                    this.accounts = [];
                }
            },

            async loadContacts() {
                try {
                    const res = await window.api.get('/contacts?limit=200');
                    this.contacts = res.data || [];
                } catch (e) {
                    console.error('Failed to load contacts:', e);
                    this.contacts = [];
                }
            },

            async loadTags() {
                try {
                    const res = await window.api.get('/accounting/tags');
                    this.tags = res.data || [];
                } catch (e) {
                    console.error('Failed to load tags:', e);
                    this.tags = [];
                }
            },

            // Navigation and Views
            async selectGeneralLedger() {
                this.isGeneralLedger = true;
                this.selectedAccount = null;
                this.mobileTab = 'ledger';
                await this.loadGeneralLedger();
            },

            async selectAccount(acc) {
                if (!acc) return;
                this.isGeneralLedger = false;
                this.selectedAccount = acc;
                this.newTx.accountId = acc._id;
                this.mobileTab = 'statement';
                await this.loadLedger(acc._id);
            },

            switchToAccountsList() {
                this.mobileTab = 'accounts';
            },

            // Ledger Fetching
            async loadGeneralLedger() {
                this.loading = true;
                try {
                    let url = '/accounting/transactions';
                    const params = new URLSearchParams();
                    if (this.filter.startDate) params.append('startDate', this.filter.startDate);
                    if (this.filter.endDate) params.append('endDate', this.filter.endDate);

                    if (params.toString()) url += `?${params.toString()}`;

                    const res = await window.api.get(url);
                    const txs = res.data?.transactions || [];
                    this.ledgerTransactions = txs;
                    this.periodStats = res.data?.periodStats || null;
                } catch (error) {
                    console.error('General ledger error:', error);
                    this.ledgerTransactions = [];
                } finally {
                    this.loading = false;
                }
            },

            async loadLedger(accountId) {
                this.loading = true;
                try {
                    let url = `/accounting/ledger/${accountId}`;
                    const params = new URLSearchParams();
                    if (this.filter.startDate) params.append('startDate', this.filter.startDate);
                    if (this.filter.endDate) params.append('endDate', this.filter.endDate);

                    if (params.toString()) url += `?${params.toString()}`;

                    const res = await window.api.get(url);
                    const txs = res.data?.transactions || [];

                    // Calculate running balance per transaction
                    let running = Number(this.selectedAccount?.totalBalance || 0);
                    for (let i = 0; i < txs.length; i++) {
                        txs[i].runningBalance = running;
                        // Reverse change for older transaction
                        const change = txs[i].transactionType === 'Credit' ? Number(txs[i].amount) : -Number(txs[i].amount);
                        running -= change;
                    }

                    this.ledgerTransactions = txs;
                    this.periodStats = res.data?.periodStats || null;
                } catch (error) {
                    console.error('Account ledger error:', error);
                    this.ledgerTransactions = [];
                } finally {
                    this.loading = false;
                }
            },

            // Date Filters
            setFilterPreset(preset) {
                this.filter.preset = preset;
                const now = new Date();
                if (preset === 'today') {
                    const todayStr = now.toISOString().split('T')[0];
                    this.filter.startDate = todayStr;
                    this.filter.endDate = todayStr;
                } else if (preset === 'month') {
                    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                    this.filter.startDate = firstDay.toISOString().split('T')[0];
                    this.filter.endDate = now.toISOString().split('T')[0];
                } else if (preset === '30d') {
                    const past = new Date();
                    past.setDate(past.getDate() - 30);
                    this.filter.startDate = past.toISOString().split('T')[0];
                    this.filter.endDate = now.toISOString().split('T')[0];
                } else {
                    this.filter.startDate = '';
                    this.filter.endDate = '';
                }

                if (this.isGeneralLedger) {
                    this.loadGeneralLedger();
                } else if (this.selectedAccount) {
                    this.loadLedger(this.selectedAccount._id);
                }
            },

            // Modals & CRUD
            openAddAccountModal() {
                this.editMode.account = false;
                this.newAccount = {
                    _id: '',
                    contactId: '',
                    accountType: 'Receivable',
                    accountName: ''
                };
                this.accountContactSearch = '';
                this.accountContactDropdownOpen = false;
                this.contactSearchResults = (this.contacts || []).slice(0, 15);
                this.modals.addAccount = true;
            },

            onAccountContactChanged() {
                const contact = this.contacts.find(c => c._id === this.newAccount.contactId);
                if (contact) {
                    this.newAccount.accountType = contact.contactType === 'Customer' ? 'Receivable' : 'Payable';
                    this.newAccount.accountName = `${contact.name}'s Ledger`;
                }
            },

            async createAccount() {
                if (!this.newAccount.contactId || !this.newAccount.accountName) return;
                try {
                    this.loading = true;
                    await window.api.post('/accounting/get-account', this.newAccount);
                    window.showNotification?.('Ledger account established successfully', 'success');
                    this.modals.addAccount = false;
                    await Promise.all([this.loadAccounts(), this.loadSummary()]);
                } catch (error) {
                    window.showNotification?.(error.response?.data?.message || 'Failed to create ledger', 'error');
                } finally {
                    this.loading = false;
                }
            },

            editAccount(acc) {
                this.editMode.account = true;
                this.newAccount = {
                    _id: acc._id,
                    contactId: acc.contact?._id || '',
                    accountType: acc.accountType,
                    accountName: acc.accountName
                };
                this.accountContactSearch = acc.contact ? (acc.contact.name + (acc.contact.companyName ? ` (${acc.contact.companyName})` : '')) : '';
                this.accountContactDropdownOpen = false;
                this.modals.addAccount = true;
            },

            async updateAccountSettings() {
                try {
                    this.loading = true;
                    await window.api.put(`/accounting/accounts/${this.newAccount._id}`, this.newAccount);
                    window.showNotification?.('Ledger settings updated', 'success');
                    this.modals.addAccount = false;
                    await Promise.all([this.loadAccounts(), this.loadSummary()]);
                    if (this.selectedAccount?._id === this.newAccount._id) {
                        this.selectedAccount = { ...this.selectedAccount, ...this.newAccount };
                    }
                } catch (error) {
                    window.showNotification?.(error.response?.data?.message || 'Update failed', 'error');
                } finally {
                    this.loading = false;
                }
            },

            async confirmDeleteAccount() {
                if (!this.selectedAccount) return;
                const msg = `Are you sure you want to delete "${this.selectedAccount.accountName}"? All vouchers in this ledger will be removed.`;
                if (!confirm(msg)) return;
                try {
                    this.loading = true;
                    await window.api.delete(`/accounting/accounts/${this.selectedAccount._id}`);
                    window.showNotification?.('Ledger removed successfully', 'success');
                    this.selectedAccount = null;
                    await Promise.all([this.loadAccounts(), this.loadSummary()]);
                    await this.selectGeneralLedger();
                } catch (error) {
                    window.showNotification?.(error.response?.data?.message || 'Failed to remove ledger', 'error');
                } finally {
                    this.loading = false;
                }
            },

            openAddTransactionModal(presetAccountId = null) {
                this.editMode.transaction = false;
                const targetAccountId = presetAccountId || this.selectedAccount?._id || (this.accounts[0]?._id || '');
                const targetAcc = this.accounts.find(a => a._id === targetAccountId);
                this.newTx = {
                    _id: '',
                    accountId: targetAccountId,
                    amount: '',
                    transactionType: 'Credit',
                    date: new Date().toISOString().split('T')[0],
                    tagId: '',
                    description: '',
                    reference: ''
                };
                this.txAccountSearch = targetAcc ? targetAcc.accountName : '';
                this.txAccountDropdownOpen = false;
                this.modals.addTransaction = true;
            },

            editTransaction(tx) {
                this.editMode.transaction = true;
                const targetAccountId = tx.account?._id || tx.account || '';
                const targetAcc = this.accounts.find(a => a._id === targetAccountId);
                this.newTx = {
                    _id: tx._id,
                    accountId: targetAccountId,
                    amount: tx.amount,
                    transactionType: tx.transactionType,
                    date: new Date(tx.date).toISOString().split('T')[0],
                    tagId: tx.tag?._id || tx.tag || '',
                    description: tx.description || '',
                    reference: tx.reference || ''
                };
                this.txAccountSearch = targetAcc ? targetAcc.accountName : '';
                this.txAccountDropdownOpen = false;
                this.modals.addTransaction = true;
            },

            async saveTransaction() {
                if (!this.isTxValid) return;
                try {
                    this.loading = true;
                    if (this.editMode.transaction) {
                        await window.api.put(`/accounting/transaction/${this.newTx._id}`, this.newTx);
                        window.showNotification?.('Voucher updated successfully', 'success');
                    } else {
                        await window.api.post('/accounting/transaction', this.newTx);
                        window.showNotification?.('Voucher posted successfully', 'success');
                    }

                    this.modals.addTransaction = false;
                    await this.refreshAllData();
                } catch (error) {
                    window.showNotification?.(error.response?.data?.message || 'Failed to save voucher', 'error');
                } finally {
                    this.loading = false;
                }
            },

            async deleteTransaction(txId) {
                if (!confirm('Are you sure you want to delete this voucher? Account balance will be reverted.')) return;
                try {
                    this.loading = true;
                    await window.api.delete(`/accounting/transaction/${txId}`);
                    window.showNotification?.('Voucher removed and balance reverted', 'success');
                    await this.refreshAllData();
                } catch (error) {
                    window.showNotification?.(error.response?.data?.message || 'Failed to remove voucher', 'error');
                } finally {
                    this.loading = false;
                }
            },

            async refreshAllData() {
                await Promise.all([this.loadSummary(), this.loadAccounts()]);
                if (this.isGeneralLedger) {
                    await this.loadGeneralLedger();
                } else if (this.selectedAccount) {
                    const updated = this.accounts.find(a => a._id === this.selectedAccount._id);
                    if (updated) this.selectedAccount.totalBalance = updated.totalBalance;
                    await this.loadLedger(this.selectedAccount._id);
                }
            },

            // Tag Management
            async createTag() {
                if (!this.newTag.name.trim()) return;
                try {
                    await window.api.post('/accounting/tags', this.newTag);
                    window.showNotification?.('Tag created successfully', 'success');
                    this.newTag = { name: '', color: '#7c3aed' };
                    await this.loadTags();
                } catch (error) {
                    window.showNotification?.('Failed to create tag', 'error');
                }
            },

            async deleteTag(tagId) {
                if (!confirm('Delete this classification tag?')) return;
                try {
                    await window.api.delete(`/accounting/tags/${tagId}`);
                    window.showNotification?.('Tag removed', 'success');
                    await this.loadTags();
                } catch (error) {
                    window.showNotification?.('Failed to delete tag', 'error');
                }
            },

            // WhatsApp Statement Sharing
            sendWhatsAppStatement() {
                if (!this.selectedAccount) return;
                const contact = this.selectedAccount.contact;
                const phone = contact?.phone?.replace(/[^0-9]/g, '');
                if (!phone) {
                    window.showNotification?.('No phone number recorded for this party', 'warning');
                    return;
                }

                const bal = Number(this.selectedAccount.totalBalance || 0);
                const balType = bal >= 0 ? 'Receivable (Due to us)' : 'Payable (Advance / Credit)';
                const formattedAmt = '₹' + Math.abs(bal).toLocaleString('en-IN');

                const msg = encodeURIComponent(
                    `Hello ${contact.name},\n\n` +
                    `Here is your account statement summary from shop:\n` +
                    `Account: ${this.selectedAccount.accountName}\n` +
                    `Outstanding Balance: ${formattedAmt} [${balType}]\n` +
                    `Vouchers in period: ${this.ledgerTransactions.length}\n\n` +
                    `Please let us know if you need the detailed invoice records. Thank you!`
                );

                const cleanPhone = phone.startsWith('91') ? phone : (phone.length === 10 ? '91' + phone : phone);
                window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
            },

            // Utility formatters
            formatNumber(num) {
                return new Intl.NumberFormat('en-IN').format(num || 0);
            },

            formatDate(dateStr) {
                if (!dateStr) return '-';
                return new Date(dateStr).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
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
