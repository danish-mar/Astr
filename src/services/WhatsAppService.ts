import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import path from 'path';
import fs from 'fs';
import { ShopSettings } from '../models';

class WhatsAppService {
    private client: Client;
    private qrCode: string | null = null;
    private status: 'INITIALIZING' | 'AUTHENTICATED' | 'READY' | 'DISCONNECTED' = 'INITIALIZING';

    constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth({
                dataPath: path.join(process.cwd(), '.wwebjs_auth')
            }),
            puppeteer: {
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ],
                handleSIGINT: false
            }
        });

        this.initialize();
    }

    private initialize() {
        this.client.on('qr', (qr) => {
            this.qrCode = qr;
            this.status = 'INITIALIZING';
            console.log('WhatsApp QR Code generated. Please scan it in the dashboard.');
            // qrcode.generate(qr, { small: true }); // For terminal debugging
        });

        this.client.on('authenticated', () => {
            console.log('WhatsApp Authenticated');
            this.status = 'AUTHENTICATED';
            this.qrCode = null;
        });

        this.client.on('ready', () => {
            console.log('WhatsApp Client is Ready');
            this.status = 'READY';
        });

        this.client.on('auth_failure', (msg) => {
            console.error('WhatsApp Auth Failure:', msg);
            this.status = 'DISCONNECTED';
        });

        this.client.on('disconnected', (reason) => {
            console.log('WhatsApp Disconnected:', reason);
            this.status = 'DISCONNECTED';
            this.initialize(); // Re-initialize
        });

        this.client.initialize().catch(err => {
            console.error('Failed to initialize WhatsApp Client:', err);
        });
    }

    public async logout() {
        try {
            if (this.client) {
                await this.client.logout();
                this.status = 'DISCONNECTED';
                this.qrCode = null;
                console.log('WhatsApp Client Logged Out');
                
                // Automatically try to re-init to get a new QR code
                this.reinitialize();
            }
            return true;
        } catch (error) {
            console.error('Error during WhatsApp logout:', error);
            return false;
        }
    }

    public async reinitialize() {
        try {
            this.status = 'INITIALIZING';
            this.qrCode = null;
            
            // If client is already running, we might need to destroy and recreate if it's stuck
            // But usually just calling initialize() again if disconnected might work, 
            // however if logout() was called, we should just wait for 'qr'
            
            // To be safe, if we are DISCONNECTED, we can try to boot it again
            await this.client.initialize().catch(err => {
                console.log('WhatsApp already initialized or error:', err.message);
            });
            
            return true;
        } catch (error) {
            console.error('Error during WhatsApp reinitialization:', error);
            return false;
        }
    }

    public getStatus() {
        return {
            status: this.status,
            qrCode: this.qrCode
        };
    }

    public async sendMessage(to: string, message: string) {
        if (this.status !== 'READY') {
            console.warn('Attempted to send message while WhatsApp client is not ready');
            return false;
        }

        try {
            // Format number (remove non-digits and ensure correct format)
            const cleanNumber = to.replace(/\D/g, '');
            const chatId = cleanNumber.length <= 10 ? `91${cleanNumber}@c.us` : `${cleanNumber}@c.us`;
            
            await this.client.sendMessage(chatId, message);
            return true;
        } catch (error) {
            console.error('Error sending WhatsApp message:', error);
            return false;
        }
    }

    // High-level triggers for service tickets
    public async sendTicketCreatedNotification(ticket: any) {
        const customer = ticket.customer;
        if (!customer || !customer.phone) return;

        const settings = await (ShopSettings as any).getSettings();
        const shopName = settings?.shopName || 'our shop';

        const message = `✨ *Welcome to ${shopName}!* 🛠️

Hello ${customer.name || 'Customer'},
Thank you for choosing us. We have successfully registered your service request.

*Ticket Details:*
• *Tracking ID:* *#${ticket.ticketNumber}*
• *Device:* ${ticket.deviceDetails}
• *Status:* ${ticket.status}

You can track your progress by quoting your ID: *#${ticket.ticketNumber}*
We'll keep you updated on progress!`;

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

        const message = `${statusEmoji} ${statusHeader}

Hello ${customer.name || 'Customer'},
The status of your service ticket has been updated.

*Updated Details:*
• *Ticket ID:* *#${ticket.ticketNumber}*
• *Device:* ${ticket.deviceDetails}
• *New Status:* ${ticket.status}

${footer}`;

        return this.sendMessage(customer.phone, message);
    }
}

export default new WhatsAppService();
