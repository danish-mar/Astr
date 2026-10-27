import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import path from 'path';
import fs from 'fs';
import { ShopSettings } from '../models';
import WhatsAppAgentService from './WhatsAppAgentService';
import qrcodeTerminal from 'qrcode-terminal';

class WhatsAppService {
    private client: Client | null = null;
    private qrCode: string | null = null;
    private status: 'INITIALIZING' | 'AUTHENTICATED' | 'READY' | 'DISCONNECTED' = 'INITIALIZING';
    private loadingPercent: number = 0;
    private loadingMessage: string = '';
    private authTimeoutTimer: NodeJS.Timeout | null = null;

    constructor() {
        this.clearStaleLocks();
        this.createClient();
        this.setupProcessCleanup();
    }

    private clearStaleLocks() {
        try {
            const sessionPath = path.join(process.cwd(), '.wwebjs_auth', 'session');
            if (!fs.existsSync(sessionPath)) return;

            const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
            for (const lock of lockFiles) {
                const target = path.join(sessionPath, lock);
                if (fs.existsSync(target)) {
                    try {
                        fs.unlinkSync(target);
                        console.log(`[WhatsAppService] Removed stale lock file: ${lock}`);
                    } catch (e) {
                        // ignore unlink errors
                    }
                }
            }
        } catch (err) {
            console.warn('[WhatsAppService] Error checking stale locks:', err);
        }
    }

    private setupProcessCleanup() {
        const cleanup = async (sig?: string) => {
            if (this.client) {
                try {
                    await this.client.destroy();
                    this.client = null;
                } catch (e) {
                    // ignore
                }
            }
            if (sig === 'SIGUSR2') {
                process.kill(process.pid, 'SIGUSR2');
            }
        };

        process.once('SIGINT', () => cleanup('SIGINT'));
        process.once('SIGTERM', () => cleanup('SIGTERM'));
        process.once('SIGUSR2', () => cleanup('SIGUSR2'));
    }

    private createClient() {
        this.clearStaleLocks();

        this.client = new Client({
            authStrategy: new LocalAuth({
                dataPath: path.join(process.cwd(), '.wwebjs_auth')
            }),
            puppeteer: {
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-first-run',
                    '--no-zygote'
                ]
            }
        });

        this.setupClientEvents();

        this.client.initialize().catch((err) => {
            const isNetworkError = /timed out|ECONNREFUSED|ENOTFOUND|net::|ERR_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/i.test(String(err));
            if (isNetworkError) {
                console.warn('[WhatsAppService] Network error during initialization — will retry automatically:', err.message || err);
            } else {
                console.error('[WhatsAppService] Failed to initialize WhatsApp Client:', err);
            }
            this.status = 'DISCONNECTED';
            this.scheduleRetry(1);
        });
    }

    private retryTimer: NodeJS.Timeout | null = null;

    /** Schedules an initialization retry with exponential back-off (capped at 5 min). */
    private scheduleRetry(attempt: number) {
        if (this.retryTimer) clearTimeout(this.retryTimer);
        // 10s, 20s, 40s, 80s … cap at 300s
        const delaySec = Math.min(10 * Math.pow(2, attempt - 1), 300);
        this.loadingMessage = `Connection unavailable — retrying in ${delaySec}s (attempt ${attempt})…`;
        console.log(`[WhatsAppService] ⏳ Retry #${attempt} in ${delaySec}s…`);

        this.retryTimer = setTimeout(async () => {
            if (this.status === 'READY') return; // recovered elsewhere
            console.log(`[WhatsAppService] 🔄 Attempting reconnect #${attempt}…`);
            this.loadingMessage = `Reconnecting… (attempt ${attempt})`;
            try {
                await this.reinitialize(false);
            } catch (err) {
                // reinitialize failed — keep retrying
                this.scheduleRetry(attempt + 1);
            }
        }, delaySec * 1000);
    }

    private setupClientEvents() {
        if (!this.client) return;

        this.client.on('qr', (qr) => {
            this.qrCode = qr;
            this.status = 'INITIALIZING';
            this.loadingPercent = 0;
            this.loadingMessage = 'Awaiting QR scan';
            console.log('[WhatsAppService] QR Code generated. Scan in terminal or via dashboard:');
            try {
                qrcodeTerminal.generate(qr, { small: true });
            } catch {
                // ignore
            }
        });

        this.client.on('authenticated', () => {
            console.log('[WhatsAppService] WhatsApp Authenticated');
            this.status = 'AUTHENTICATED';
            this.qrCode = null;
            this.loadingMessage = 'Validating session & syncing chats...';

            if (this.authTimeoutTimer) clearTimeout(this.authTimeoutTimer);
            this.authTimeoutTimer = setTimeout(() => {
                if (this.status === 'AUTHENTICATED') {
                    console.warn('[WhatsAppService] Authentication took too long without ready event.');
                    this.status = 'DISCONNECTED';
                    this.loadingMessage = 'Session validation timed out. Please retry.';
                }
            }, 90000);
        });

        this.client.on('loading_screen', (percent: any, message: any) => {
            this.loadingPercent = typeof percent === 'number' ? percent : parseInt(String(percent), 10) || 0;
            this.loadingMessage = message || `Loading WhatsApp... ${percent}%`;
            console.log(`[WhatsAppService] Loading Screen: ${percent}% - ${message}`);
        });

        this.client.on('ready', () => {
            console.log('[WhatsAppService] WhatsApp Client is Ready');
            this.status = 'READY';
            this.loadingPercent = 100;
            this.loadingMessage = 'Active';
            if (this.authTimeoutTimer) {
                clearTimeout(this.authTimeoutTimer);
                this.authTimeoutTimer = null;
            }
        });

        this.client.on('auth_failure', (msg) => {
            console.error('[WhatsAppService] Auth Failure:', msg);
            this.status = 'DISCONNECTED';
            this.loadingMessage = 'Authentication failed. Please re-scan QR code.';
        });

        this.client.on('disconnected', (reason) => {
            console.log('[WhatsAppService] Disconnected:', reason);
            this.status = 'DISCONNECTED';
            this.loadingMessage = `Disconnected: ${reason}`;
            // Auto-reconnect on unexpected disconnections (not explicit logout)
            if (reason !== 'LOGOUT') {
                this.scheduleRetry(1);
            }
        });

        const processedMessages = new Set<string>();

        const handleMsg = async (msg: any) => {
            if (!msg) return;
            const msgId = msg.id?._serialized || msg.id?.id || (String(msg.timestamp) + '_' + String(msg.from));
            if (msgId) {
                if (processedMessages.has(msgId)) return;
                processedMessages.add(msgId);
                if (processedMessages.size > 1000) {
                    const first = processedMessages.values().next().value;
                    if (first) processedMessages.delete(first);
                }
            }

            const senderName = msg._data?.notifyName || msg.notifyName || '';
            console.log(`[WhatsAppService] 📥 Received message from: ${msg.from}${senderName ? ` (${senderName})` : ''} | fromMe: ${Boolean(msg.fromMe)} | Body: "${msg.body || ''}"`);

            try {
                await WhatsAppAgentService.handleIncomingMessage(msg, this);
            } catch (err) {
                console.error('[WhatsAppAgentService] Error processing incoming message:', err);
            }
        };

        this.client.on('message', handleMsg);
        // message_create fires for both inbound AND outbound (our own sent messages).
        // The agent already checks msg.fromMe, but removing this listener entirely
        // avoids unnecessary processing and the duplicate-authenticated log spam.
    }

    public async logout() {
        try {
            if (this.client) {
                try {
                    await this.client.logout();
                } catch (e) {
                    // ignore
                }
                try {
                    await this.client.destroy();
                } catch (e) {
                    // ignore
                }
            }
            this.status = 'DISCONNECTED';
            this.qrCode = null;
            this.loadingPercent = 0;
            this.loadingMessage = '';

            // Clean auth storage directory on explicit logout
            const authPath = path.join(process.cwd(), '.wwebjs_auth');
            try {
                fs.rmSync(authPath, { recursive: true, force: true });
            } catch (e) {
                // ignore
            }

            console.log('[WhatsAppService] Client Logged Out and Session Cleared');
            this.createClient();
            return true;
        } catch (error) {
            console.error('[WhatsAppService] Error during logout:', error);
            return false;
        }
    }

    public async reinitialize(cleanSession = false) {
        try {
            this.status = 'INITIALIZING';
            this.qrCode = null;
            this.loadingPercent = 0;
            this.loadingMessage = 'Re-initializing engine...';

            if (this.authTimeoutTimer) {
                clearTimeout(this.authTimeoutTimer);
                this.authTimeoutTimer = null;
            }

            if (this.client) {
                try {
                    await this.client.destroy();
                } catch (e) {
                    // ignore
                }
                this.client = null;
                // Allow browser process to completely exit and release file locks
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            if (cleanSession) {
                const authPath = path.join(process.cwd(), '.wwebjs_auth');
                try {
                    fs.rmSync(authPath, { recursive: true, force: true });
                } catch (e) {
                    // ignore
                }
            }

            this.createClient();
            return true;
        } catch (error) {
            console.error('[WhatsAppService] Error during reinitialization:', error);
            this.status = 'DISCONNECTED';
            return false;
        }
    }

    public getStatus() {
        return {
            status: this.status,
            qrCode: this.qrCode,
            loadingPercent: this.loadingPercent,
            loadingMessage: this.loadingMessage
        };
    }

    public async resolvePhoneNumber(chatId: string): Promise<string | null> {
        if (!this.client || !chatId) return null;
        const cleanId = String(chatId).trim();

        // 1. If it's a standard phone JID (@c.us or @s.whatsapp.net), digits ARE the phone number
        if (cleanId.endsWith('@c.us') || cleanId.endsWith('@s.whatsapp.net')) {
            const digits = cleanId.replace(/@.*$/, '').replace(/\D/g, '');
            if (digits && digits.length >= 10 && digits.length <= 14) {
                return digits;
            }
        }

        // 2. If it's an @lid or numeric LID (>13 digits), query WhatsApp Web internal mappings
        const isLid = cleanId.endsWith('@lid') || /^\d{14,16}$/.test(cleanId);
        if (isLid) {
            const lidJid = cleanId.endsWith('@lid') ? cleanId : `${cleanId}@lid`;

            // A. Try via puppeteer page Store.LidUtils / enforceLidAndPnRetrieval
            try {
                if ((this.client as any).pupPage) {
                    const pnResult = await (this.client as any).pupPage.evaluate(async (userId: string) => {
                        try {
                            const win = globalThis as any;
                            if (win.WWebJS?.enforceLidAndPnRetrieval) {
                                const { phone } = await win.WWebJS.enforceLidAndPnRetrieval(userId);
                                if (phone?._serialized) return phone._serialized;
                                if (phone?.user) return phone.user;
                            }
                            if (win.Store?.LidUtils?.getPhoneNumber && win.Store?.WidFactory?.createWid) {
                                const wid = win.Store.WidFactory.createWid(userId);
                                const pnWid = win.Store.LidUtils.getPhoneNumber(wid);
                                if (pnWid?._serialized) return pnWid._serialized;
                                if (pnWid?.user) return pnWid.user;
                            }
                            return null;
                        } catch {
                            return null;
                        }
                    }, lidJid);

                    if (pnResult) {
                        const digits = String(pnResult).replace(/@.*$/, '').replace(/\D/g, '');
                        if (digits && digits.length >= 10 && digits.length <= 14) {
                            return digits;
                        }
                    }
                }
            } catch (err) {
                console.warn('[WhatsAppService] Page evaluate LID resolution error:', err);
            }

            // B. Try client.getContactLidAndPhone
            try {
                if (typeof (this.client as any).getContactLidAndPhone === 'function') {
                    const res = await (this.client as any).getContactLidAndPhone([lidJid]);
                    if (res?.[0]?.pn) {
                        const digits = String(res[0].pn).replace(/@.*$/, '').replace(/\D/g, '');
                        if (digits && digits.length >= 10 && digits.length <= 14) {
                            return digits;
                        }
                    }
                }
            } catch (err) {
                console.warn('[WhatsAppService] getContactLidAndPhone error:', err);
            }

            // C. Try getContactById
            try {
                if (typeof (this.client as any).getContactById === 'function') {
                    const contact = await (this.client as any).getContactById(lidJid);
                    if (contact) {
                        if (contact.id?.server === 'c.us' && contact.number) {
                            const digits = contact.number.replace(/\D/g, '');
                            if (digits && digits.length >= 10 && digits.length <= 14) return digits;
                        }
                        if (typeof contact.getFormattedNumber === 'function') {
                            const formatted = await contact.getFormattedNumber();
                            const digits = String(formatted || '').replace(/\D/g, '');
                            if (digits && digits.length >= 10 && digits.length <= 14) return digits;
                        }
                    }
                }
            } catch (_) {}
        }

        return null;
    }

    public async sendMessage(to: string, message: string) {
        if (this.status !== 'READY' || !this.client) {
            console.warn('[WhatsAppService] Cannot send message: client is not ready');
            return false;
        }

        try {
            let chatId = String(to || '').trim();
            if (!chatId) return false;

            // If it already has an explicit JID suffix, use it directly as-is
            if (!chatId.includes('@')) {
                const cleanNumber = chatId.replace(/\D/g, '');
                if (!cleanNumber) return false;

                if (cleanNumber.length > 10) {
                    // Already includes international country code (e.g. 923167255624 or 919876543210)
                    chatId = `${cleanNumber}@c.us`;
                } else if (cleanNumber.length === 10) {
                    if (/^[6-9]/.test(cleanNumber)) {
                        // Standard Indian mobile number (starts with 6, 7, 8, or 9)
                        chatId = `91${cleanNumber}@c.us`;
                    } else if (/^3[0-4]/.test(cleanNumber)) {
                        // Pakistani mobile number without leading 0 (03xx -> 3xx)
                        chatId = `92${cleanNumber}@c.us`;
                    } else {
                        chatId = `91${cleanNumber}@c.us`;
                    }
                } else {
                    chatId = `${cleanNumber}@c.us`;
                }
            }

            console.log(`[WhatsAppService] Sending message to ${chatId}...`);
            await this.client.sendMessage(chatId, message);
            return true;
        } catch (error: any) {
            const msg = String(error?.message || error);
            if (msg.includes('WWEB_NOT_READY') || msg.includes('getChat') || msg.includes('WWebJS')) {
                console.warn('[WhatsAppService] WWebJS context lost — triggering reinitialize...');
                this.scheduleRetry(1);
            } else {
                console.error('[WhatsAppService] Error sending message to', to, ':', error);
            }
            return false;
        }
    }

    public async sendDocument(to: string, buffer: Buffer, filename: string, caption?: string): Promise<boolean> {
        if (this.status !== 'READY' || !this.client) {
            console.warn('[WhatsAppService] Cannot send document: client is not ready');
            return false;
        }

        // Write buffer to a temp file — using fromFilePath avoids passing large base64
        // through pupPage.evaluate() which races against WA Web's internal store init.
        const tmpDir = path.join(process.cwd(), '.wwebjs_cache');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        const tmpPath = path.join(tmpDir, `tmp_${Date.now()}_${filename}`);

        try {
            fs.writeFileSync(tmpPath, buffer);

            let chatId = String(to || '').trim();
            if (!chatId) return false;

            if (!chatId.includes('@')) {
                const cleanNumber = chatId.replace(/\D/g, '');
                if (!cleanNumber) return false;
                if (cleanNumber.length > 10) {
                    chatId = `${cleanNumber}@c.us`;
                } else if (cleanNumber.length === 10) {
                    chatId = `91${cleanNumber}@c.us`;
                } else {
                    chatId = `${cleanNumber}@c.us`;
                }
            }

            // Pre-warm: open the chat in WA Web so the store model is fully hydrated
            try {
                await this.client.getChatById(chatId);
                await new Promise(r => setTimeout(r, 600));
            } catch (_) {}

            const media = await MessageMedia.fromFilePath(tmpPath);
            (media as any).mimetype = 'application/pdf';
            (media as any).filename = filename;

            const sendOptions = {
                caption: caption || '',
                sendMediaAsDocument: true,
            };

            console.log(`[WhatsAppService] Sending PDF document (${filename}) to ${chatId}...`);
            try {
                await this.client.sendMessage(chatId, media, sendOptions);
                return true;
            } catch (err: any) {
                console.warn(`[WhatsAppService] Failed sending to ${chatId}:`, err?.message);
                // If chatId is @lid, attempt resolved phone number fallback
                if (chatId.includes('@lid')) {
                    try {
                        const resolved = await this.resolvePhoneNumber(chatId);
                        if (resolved) {
                            const cleanDigits = resolved.replace(/\D/g, '');
                            if (cleanDigits.length >= 10 && cleanDigits.length <= 15) {
                                const fallbackChatId = `${cleanDigits}@c.us`;
                                console.log(`[WhatsAppService] Retrying send with resolved ${fallbackChatId}...`);
                                try { await this.client.getChatById(fallbackChatId); await new Promise(r => setTimeout(r, 600)); } catch (_) {}
                                await this.client.sendMessage(fallbackChatId, media, sendOptions);
                                return true;
                            }
                        }
                    } catch (retryErr: any) {
                        console.warn('[WhatsAppService] Fallback phone resolution send failed:', retryErr?.message);
                    }
                }
                throw err;
            }
        } catch (error) {
            console.error('[WhatsAppService] Error sending document to', to, ':', error);
            return false;
        } finally {
            try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {}
        }
    }

    public async sendTicketCreatedNotification(ticket: any) {
        const customer = ticket.customer;
        if (!customer || !customer.phone) return;

        const settings = await (ShopSettings as any).getSettings();
        const shopName = settings?.shopName || 'our shop';

        const message = `✨ *Welcome to ${shopName}!* 🛠️\n\nHello ${customer.name || 'Customer'},\nThank you for choosing us. We have successfully registered your service request.\n\n*Ticket Details:*\n• *Tracking ID:* *#${ticket.ticketNumber}*\n• *Device:* ${ticket.deviceDetails}\n• *Status:* ${ticket.status}\n\nYou can track your progress by quoting your ID: *#${ticket.ticketNumber}*\nWe'll keep you updated on progress!`;

        return this.sendMessage(customer.phone, message);
    }

    public async sendTicketStatusUpdate(ticket: any) {
        const customer = ticket.customer;
        if (!customer || !customer.phone) return;

        const settings = await (ShopSettings as any).getSettings();
        const shopName = settings?.shopName || 'our shop';
        const reviewUrl = settings?.reviewUrl;

        let statusEmoji = '⚙️';
        let statusHeader = '*Ticket Status Update*';
        let footer = 'Thank you!';

        if (ticket.status === 'Completed') {
            statusEmoji = '✅';
            statusHeader = '*Service Request Resolved*';
            footer = 'Your item is fixed and ready for collection! 🚀\n\nThank you for your patience.';
        } else if (ticket.status === 'Delivered') {
            statusEmoji = '📦';
            statusHeader = '*Item Successfully Delivered*';
            footer = `Thank you for choosing *${shopName}*! It was a pleasure serving you.\n\n` +
                (reviewUrl ? `If you're happy with our service, please take a moment to rate us here:\n🔗 ${reviewUrl}\n\n` : '') +
                'We hope to see you again! ✨';
        }

        const message = `${statusEmoji} ${statusHeader}\n\nHello ${customer.name || 'Customer'},\nThe status of your service ticket has been updated.\n\n*Updated Details:*\n• *Ticket ID:* *#${ticket.ticketNumber}*\n• *Device:* ${ticket.deviceDetails}\n• *New Status:* ${ticket.status}\n\n${footer}`;

        return this.sendMessage(customer.phone, message);
    }
}

export default new WhatsAppService();
