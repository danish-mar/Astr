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
            transactionType: 'Credit', // Credit = Took, Debit = Paid
            date: new Date().toISOString().split('T')[0],
            tagId: '',
            description: '',
            reference: ''
        },
        loading: false,

        async init() {
            await this.loadSummary();
            await this.loadAccounts();
            await this.loadContacts();
            await this.loadTags();
        },

        get filteredAccounts() {
            if (!this.searchQuery) return this.accounts;
            const q = this.searchQuery.toLowerCase();
            return this.accounts.filter(a =>
                a.accountName.toLowerCase().includes(q) ||
                a.contact?.name.toLowerCase().includes(q)
            );
        },

        async loadSummary() {
            try {
                const res = await window.api.get('/accounting/summary');
                this.summary = res.data;
            } catch (error) {
                console.error('Error loading summary:', error);
            }
        },

        async loadAccounts() {
            try {
                const res = await window.api.get('/accounting/accounts');
                this.accounts = res.data;
            } catch (error) {
                console.error('Error loading accounts:', error);
            }
        },

        async loadContacts() {
            try {
                const res = await window.api.get('/contacts');
                this.contacts = res.data;
            } catch (error) {
                console.error('Error loading contacts:', error);
            }
        },

        async loadTags() {
            try {
                const res = await window.api.get('/accounting/tags');
                this.tags = res.data;
            } catch (error) {
                console.error('Error loading tags:', error);
            }
        },

        async createTag() {
            try {
                await window.api.post('/accounting/tags', this.newTag);
                window.showNotification('Tag created', 'success');
                this.newTag = { name: '', color: '#6366f1' };
                await this.loadTags();
            } catch (error) {
                window.showNotification('Failed to create tag', 'error');
            }
        },

        async deleteTag(tagId) {
            if (!confirm('Delete this tag? It will be removed from all transactions.')) return;
            try {
                await window.api.delete(`/accounting/tags/${tagId}`);
                window.showNotification('Tag removed', 'success');
                await this.loadTags();
            } catch (error) {
                window.showNotification('Failed to delete tag', 'error');
            }
        },

        async confirmDeleteAccount() {
            if (!this.selectedAccount) return;

            const hasBalance = this.selectedAccount.totalBalance !== 0;
            const msg = hasBalance
                ? `WARNING: This ledger has a balance of ₹${this.formatNumber(this.selectedAccount.totalBalance)}. Deleting it will purge all its transaction history. Are you sure?`
                : 'Delete this ledger and all its transaction history?';

            if (confirm(msg)) {
                try {
                    await window.api.delete(`/accounting/accounts/${this.selectedAccount._id}`);
                    window.showNotification('Ledger deleted successfully', 'success');
                    this.selectedAccount = null;
                    await this.loadAccounts();
                    await this.loadSummary();
                } catch (error) {
                    window.showNotification('Failed to delete ledger', 'error');
                }
            }
        },

        async selectAccount(acc) {
            this.selectedAccount = acc;
            this.newTx.accountId = acc._id;
            // Clear filters when switching accounts or keep them? User might want to compare same period.
            // Let's keep filters but refresh ledger.
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
                console.error('Error loading ledger:', error);
            }
        },

        openAddAccountModal() {
            this.modals.addAccount = true;
        },

        openAddTransactionModal() {
            this.modals.addTransaction = true;
        },

        async createAccount() {
            try {
                await window.api.post('/accounting/get-account', this.newAccount);
                window.showNotification('Khatabook entry created', 'success');
                this.modals.addAccount = false;
                await this.loadAccounts();
                this.newAccount = { _id: '', contactId: '', accountType: 'Payable', accountName: '' };
            } catch (error) {
                window.showNotification('Failed to create entry', 'error');
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
            this.modals.editAccount = true;
        },

        async updateAccountSettings() {
            try {
                await window.api.put(`/accounting/accounts/${this.newAccount._id}`, this.newAccount);
                window.showNotification('Account updated', 'success');
                this.modals.editAccount = false;
                await this.loadAccounts();
                if (this.selectedAccount?._id === this.newAccount._id) {
                    this.selectedAccount.accountName = this.newAccount.accountName;
                    this.selectedAccount.accountType = this.newAccount.accountType;
                }
            } catch (error) {
                window.showNotification('Failed to update account', 'error');
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
            if (!confirm('Delete this transaction? The account balance will be adjusted.')) return;
            try {
                await window.api.delete(`/accounting/transaction/${txId}`);
                window.showNotification('Transaction deleted');
                await this.refreshAllData();
            } catch (error) {
                window.showNotification('Failed to delete transaction', 'error');
            }
        },

        async refreshAllData() {
            await this.loadSummary();
            await this.loadAccounts();
            if (this.selectedAccount) {
                await this.loadLedger(this.selectedAccount._id);
                const updated = this.accounts.find(a => a._id === this.selectedAccount._id);
                if (updated) this.selectedAccount.totalBalance = updated.totalBalance;
            }
        },

        async saveTransaction() {
            try {
                this.loading = true;
                if (this.editMode.transaction) {
                    await window.api.put(`/accounting/transaction/${this.newTx._id}`, this.newTx);
                    window.showNotification('Transaction updated', 'success');
                } else {
                    await window.api.post('/accounting/transaction', this.newTx);
                    window.showNotification('Voucher posted to ledger', 'success');
                }

                this.modals.addTransaction = false;
                this.editMode.transaction = false;
                await this.refreshAllData();

                // Reset form
                const lastAccId = this.newTx.accountId;
                this.newTx = {
                    _id: '',
                    accountId: lastAccId,
                    amount: '',
                    transactionType: 'Credit',
                    tagId: '',
                    date: new Date().toISOString().split('T')[0],
                    description: '',
                    reference: ''
                };
            } catch (error) {
                window.showNotification('Failed to save transaction', 'error');
            } finally {
                this.loading = false;
            }
        },

        getContextAccount() {
            if (!this.newTx.accountId) return null;
            return this.accounts.find(a => a._id === this.newTx.accountId);
        },

        formatNumber(num) {
            return new Intl.NumberFormat('en-IN', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(num || 0);
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
