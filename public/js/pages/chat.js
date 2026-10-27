/**
 * Astr AI ERP Copilot Chat Controller (ChatGPT Multi-Session Edition)
 */
document.addEventListener('alpine:init', () => {
    Alpine.data('chatPage', () => ({
        sessions: [],
        currentSessionId: null,
        inputText: '',
        isThinking: false,
        isSidebarOpen: true,
        searchFilter: '',
        aiStatus: {
            isConfigured: false,
            provider: 'Loading...',
            model: '',
            shopName: 'Astr'
        },

        get currentSession() {
            return this.sessions.find(s => s.id === this.currentSessionId) || null;
        },

        get currentMessages() {
            return this.currentSession ? this.currentSession.messages : [];
        },

        get filteredSessions() {
            if (!this.searchFilter.trim()) return this.sessions;
            const q = this.searchFilter.toLowerCase();
            return this.sessions.filter(s => (s.title || '').toLowerCase().includes(q));
        },

        async init() {
            // 1. Fetch AI Status
            await this.fetchStatus();

            // 2. Load Multi-Chat Sessions
            this.loadSessions();

            // 3. Register Shortcuts
            window.addEventListener('keydown', (e) => {
                if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o') {
                    e.preventDefault();
                    this.newChat();
                }
            });
        },

        async fetchStatus() {
            try {
                const res = await Alpine.store('app').api('/ai/status');
                if (res.success && res.data) {
                    this.aiStatus = res.data;
                }
            } catch (err) {
                console.warn('Could not fetch AI status:', err);
            }
        },

        loadSessions() {
            try {
                const saved = localStorage.getItem('astr_copilot_sessions_v2');
                if (saved) {
                    this.sessions = JSON.parse(saved);
                } else {
                    // Backward-compat: migrate older single-chat history if available
                    const oldHistory = localStorage.getItem('astr_copilot_history');
                    if (oldHistory) {
                        const parsedOld = JSON.parse(oldHistory);
                        if (Array.isArray(parsedOld) && parsedOld.length > 0) {
                            const initial = {
                                id: 'sess_' + Date.now(),
                                title: parsedOld[0]?.content?.slice(0, 30) || 'Previous conversation',
                                createdAt: Date.now(),
                                updatedAt: Date.now(),
                                messages: parsedOld
                            };
                            this.sessions = [initial];
                        }
                    }
                }
            } catch (e) {
                this.sessions = [];
            }

            if (!this.sessions || this.sessions.length === 0) {
                this.newChat();
            } else {
                const lastActiveId = localStorage.getItem('astr_current_chat_id');
                const found = this.sessions.find(s => s.id === lastActiveId);
                this.currentSessionId = found ? found.id : this.sessions[0].id;
                this.scrollToBottom();
            }
        },

        persistSessions() {
            try {
                localStorage.setItem('astr_copilot_sessions_v2', JSON.stringify(this.sessions));
                if (this.currentSessionId) {
                    localStorage.setItem('astr_current_chat_id', this.currentSessionId);
                }
            } catch (e) {
                console.warn('Could not persist chat sessions:', e);
            }
        },

        newChat() {
            // If current session is already completely empty, simply reuse it
            if (this.currentSession && this.currentSession.messages.length === 0) {
                this.focusInput();
                return;
            }

            const newSess = {
                id: 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                title: 'New chat',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                messages: []
            };

            this.sessions.unshift(newSess);
            this.currentSessionId = newSess.id;
            this.persistSessions();
            this.focusInput();
            this.scrollToBottom();
        },

        selectSession(id) {
            this.currentSessionId = id;
            this.persistSessions();
            this.scrollToBottom();
            this.focusInput();
        },

        deleteSession(id) {
            if (!confirm('Delete this conversation?')) return;
            this.sessions = this.sessions.filter(s => s.id !== id);
            if (this.currentSessionId === id) {
                if (this.sessions.length > 0) {
                    this.currentSessionId = this.sessions[0].id;
                } else {
                    this.newChat();
                }
            }
            this.persistSessions();
        },

        renameSession(id) {
            const sess = this.sessions.find(s => s.id === id);
            if (!sess) return;
            const newTitle = prompt('Enter conversation title:', sess.title);
            if (newTitle && newTitle.trim()) {
                sess.title = newTitle.trim();
                this.persistSessions();
            }
        },

        focusInput() {
            setTimeout(() => {
                const textarea = document.querySelector('textarea');
                if (textarea) textarea.focus();
            }, 60);
        },

        async sendMessage() {
            const query = this.inputText.trim();
            if (!query || this.isThinking) return;

            let session = this.currentSession;
            if (!session) {
                this.newChat();
                session = this.currentSession;
            }

            // Auto-title session from first user message
            if (session.messages.length === 0 || session.title === 'New chat') {
                session.title = query.length > 30 ? query.slice(0, 30) + '...' : query;
            }
            session.updatedAt = Date.now();

            // Add user message
            session.messages.push({
                role: 'user',
                content: query,
                cardType: 'text',
                cardData: null,
                timestamp: new Date().toISOString()
            });

            this.inputText = '';
            this.isThinking = true;
            this.persistSessions();
            this.scrollToBottom();

            // Prepare history for LLM context (last 6 messages)
            const historyPayload = session.messages.slice(-6).map(m => ({
                role: m.role,
                content: m.content
            }));

            try {
                const res = await Alpine.store('app').api('/ai/chat', 'POST', {
                    message: query,
                    history: historyPayload
                });

                if (res.success && res.data) {
                    const data = res.data;
                    session.messages.push({
                        role: 'assistant',
                        content: data.reply || 'Request completed.',
                        cardType: data.cardType || 'text',
                        cardData: data.cardData || null,
                        timestamp: new Date().toISOString()
                    });

                    // Trigger toast for saved documents or tickets
                    if (data.cardType === 'invoice') {
                        const doc = data.cardData;
                        window.showNotification?.(`${doc.docType || 'Document'} ${doc.docNumber || ''} saved successfully!`, 'success');
                    } else if (data.cardType === 'ticket') {
                        const t = data.cardData;
                        window.showNotification?.(`Service Ticket #${t.ticketNumber} registered!`, 'success');
                    }
                } else {
                    session.messages.push({
                        role: 'assistant',
                        content: res.message || 'Something went wrong while processing your request.',
                        cardType: 'text',
                        cardData: null
                    });
                }
            } catch (err) {
                console.error('Chat error:', err);
                const errMsg = err.response?.data?.message || err.message || 'Failed to communicate with AI Assistant.';
                session.messages.push({
                    role: 'assistant',
                    content: `⚠️ ${errMsg}`,
                    cardType: 'text',
                    cardData: null
                });
            } finally {
                this.isThinking = false;
                this.persistSessions();
                this.scrollToBottom();
            }
        },

        usePrompt(text) {
            this.inputText = text;
            this.sendMessage();
        },

        addPrompt(text) {
            this.inputText = text;
            this.focusInput();
        },

        scrollToBottom() {
            setTimeout(() => {
                const container = document.getElementById('chatMessagesContainer');
                if (container) {
                    container.scrollTop = container.scrollHeight;
                }
            }, 60);
        }
    }));
});
