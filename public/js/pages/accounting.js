function accountingData() {
    return {
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
        loading: false,
        filter: {
            startDate: '',
            endDate: ''
        },
        modals: {
            addAccount: false,
            addTransaction: false,
            manageTags: false,
            editAccount: false
        },
        editMode: {
            account: false,
            transaction: false
        },
        newTag: {
            name: '',
            color: '#6366f1'
        },
        newAccount: {
            _id: '',
            contactId: '',
            accountType: 'Payable',
            accountName: ''
        },
        newTx: {
            _id: '',
            accountId: '',
            amount: '',
            transactionType: 'Credit', // Credit = Took (Receivable/Cr.), Debit = Paid (Payable/Dr.)
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
            } finally {
                this.loading = false;
            }
        },

        // Computed
        get filteredAccounts() {
            if (!this.searchQuery) return this.accounts;
            const q = this.searchQuery.toLowerCase();
            return this.accounts.filter(a =>
                a.accountName.toLowerCase().includes(q) ||
                (a.contact?.name || '').toLowerCase().includes(q)
            );
        },

        get isTxValid() {
            return this.newTx.accountId && this.newTx.amount > 0;
        },

        // API Methods
        async loadSummary() {
            const res = await window.api.get('/accounting/summary');
            console.log("[Accounting] Summary Loaded:", res.data);
            this.summary = res.data;
        },

        async loadAccounts() {
            const res = await window.api.get('/accounting/accounts');
            this.accounts = res.data;
        },

        async loadContacts() {
            const res = await window.api.get('/contacts');
            this.contacts = res.data;
        },

        async loadTags() {
            const res = await window.api.get('/accounting/tags');
            this.tags = res.data;
        },

        async createTag() {
            if (!this.newTag.name) return;
            try {
                await window.api.post('/accounting/tags', this.newTag);
                window.showNotification('Classification updated', 'success');
                this.newTag = { name: '', color: '#6366f1' };
                await this.loadTags();
            } catch (error) {
                window.showNotification('Failed to save category', 'error');
            }
        },

        async deleteTag(tagId) {
            if (!confirm('Permanent deletion of this category?')) return;
            try {
                await window.api.delete(`/accounting/tags/${tagId}`);
                window.showNotification('Category removed', 'success');
                await this.loadTags();
            } catch (error) {
                window.showNotification('Failed to remove category', 'error');
            }
        },

        async selectAccount(acc) {
            this.selectedAccount = acc;
            this.newTx.accountId = acc._id;
            await this.loadLedger(acc._id);
        },

        async loadLedger(accountId) {
            try {
                let url = `/accounting/ledger/${accountId}`;
                const params = new URLSearchParams();
                if (this.filter.startDate) params.append('startDate', this.filter.startDate);
                if (this.filter.endDate) params.append('endDate', this.filter.endDate);

                if (params.toString()) url += `?${params.toString()}`;

                const res = await window.api.get(url);
                this.ledgerTransactions = res.data.transactions;
                this.periodStats = res.data.periodStats;
            } catch (error) {
                console.error('Ledger error:', error);
            }
        },

        openAddAccountModal() {
            this.editMode.account = false;
            this.newAccount = { _id: '', contactId: '', accountType: 'Payable', accountName: '' };
            this.modals.addAccount = true;
        },

        openAddTransactionModal() {
            this.editMode.transaction = false;
            // Retain selected account if present
            const currentAcc = this.selectedAccount?._id || '';
            this.newTx = {
                _id: '',
                accountId: currentAcc,
                amount: '',
                transactionType: 'Credit',
                date: new Date().toISOString().split('T')[0],
                tagId: '',
                description: '',
                reference: ''
            };
            this.modals.addTransaction = true;
        },

        async createAccount() {
            try {
                this.loading = true;
                await window.api.post('/accounting/get-account', this.newAccount);
                window.showNotification('Ledger entry established', 'success');
                this.modals.addAccount = false;
                await this.loadAccounts();
            } catch (error) {
                window.showNotification('Operation failed', 'error');
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
            this.modals.addAccount = true;
        },

        async updateAccountSettings() {
            try {
                this.loading = true;
                await window.api.put(`/accounting/accounts/${this.newAccount._id}`, this.newAccount);
                window.showNotification('Ledger master updated', 'success');
                this.modals.addAccount = false;
                await this.loadAccounts();
                if (this.selectedAccount?._id === this.newAccount._id) {
                    this.selectedAccount = { ...this.selectedAccount, ...this.newAccount };
                }
            } catch (error) {
                window.showNotification('Update aborted', 'error');
            } finally {
                this.loading = false;
            }
        },

        editTransaction(tx) {
            this.editMode.transaction = true;
            this.newTx = {
                _id: tx._id,
                accountId: tx.account,
                amount: tx.amount,
                transactionType: tx.transactionType,
                date: new Date(tx.date).toISOString().split('T')[0],
                tagId: tx.tag?._id || tx.tag || '',
                description: tx.description || '',
                reference: tx.reference || ''
            };
            this.modals.addTransaction = true;
        },

        async deleteTransaction(txId) {
            if (!confirm('Permanent deletion will adjust balance. Proceed?')) return;
            try {
                await window.api.delete(`/accounting/transaction/${txId}`);
                window.showNotification('Voucher purged');
                await this.refreshAllData();
            } catch (error) {
                window.showNotification('Purge failed', 'error');
            }
        },

        async refreshAllData() {
            await Promise.all([this.loadSummary(), this.loadAccounts()]);
            if (this.selectedAccount) {
                await this.loadLedger(this.selectedAccount._id);
                const updated = this.accounts.find(a => a._id === this.selectedAccount._id);
                if (updated) this.selectedAccount.totalBalance = updated.totalBalance;
            }
        },

        async saveTransaction() {
            if (!this.isTxValid) return;
            try {
                this.loading = true;
                if (this.editMode.transaction) {
                    await window.api.put(`/accounting/transaction/${this.newTx._id}`, this.newTx);
                    window.showNotification('Voucher revised', 'success');
                } else {
                    await window.api.post('/accounting/transaction', this.newTx);
                    window.showNotification('Voucher posted', 'success');
                }

                this.modals.addTransaction = false;
                await this.refreshAllData();
            } catch (error) {
                window.showNotification('Posting failed', 'error');
            } finally {
                this.loading = false;
            }
        },

        async confirmDeleteAccount() {
            if (!this.selectedAccount) return;
            const msg = `CRITICAL: Deleting this ledger will permanently purge all related transaction history. Proceed?`;
            if (confirm(msg)) {
                try {
                    await window.api.delete(`/accounting/accounts/${this.selectedAccount._id}`);
                    window.showNotification('Ledger master purged', 'success');
                    this.selectedAccount = null;
                    await this.loadAccounts();
                    await this.loadSummary();
                } catch (error) {
                    window.showNotification('Action failed', 'error');
                }
            }
        },

        formatNumber(num) {
            return new Intl.NumberFormat('en-IN').format(num || 0);
        },

        formatDate(dateStr) {
            return new Date(dateStr).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        }
    };
}
