import { Router } from 'express';
import WhatsAppService from '../services/WhatsAppService';
import { authenticate as protect, requirePermission } from '../middleware/auth';

const router = Router();

// Protect all routes
router.use(protect);

const allowLeadsOrSettings = (req: any, res: any, next: any) => {
    if (!req.employee) return res.status(401).json({ success: false, message: 'Authentication required' });
    if (req.employee.position === 'Admin' || req.employee.position === 'CEO') return next();
    const perms = req.employee.permissions || [];
    if (perms.includes('settings:manage') || perms.includes('leads:read')) return next();
    return res.status(403).json({ success: false, message: 'Access denied. Required permission: leads:read or settings:manage' });
};

// Get WhatsApp status and QR code
router.get('/status', allowLeadsOrSettings, (req, res) => {
    try {
        const status = WhatsAppService.getStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Manual reconnect/initialize
router.post('/initialize', requirePermission('settings:manage'), async (req, res) => {
    try {
        const cleanSession = req.body?.cleanSession === true;
        await WhatsAppService.reinitialize(cleanSession);
        res.json({
            success: true,
            message: 'WhatsApp service initialization triggered'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Manual logout
router.post('/logout', requirePermission('settings:manage'), async (req, res) => {
    try {
        const success = await WhatsAppService.logout();
        if (success) {
            res.json({
                success: true,
                message: 'WhatsApp account disconnected successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to disconnect WhatsApp'
            });
        }
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get AI Agent sales, metrics, and inquiry history
router.get('/sales', allowLeadsOrSettings, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const WhatsAppInquiry = (await import('../models/WhatsAppInquiry')).default;

        const [
            todayInquiries,
            todayDeals,
            allDeals,
            awaitingVendorCount,
            recentInquiries
        ] = await Promise.all([
            WhatsAppInquiry.countDocuments({ createdAt: { $gte: today } }),
            WhatsAppInquiry.find({ status: 'deal_agreed', updatedAt: { $gte: today } }),
            WhatsAppInquiry.find({ status: 'deal_agreed' }),
            WhatsAppInquiry.countDocuments({ status: 'awaiting_vendor' }),
            WhatsAppInquiry.find({}).sort({ updatedAt: -1 }).limit(30)
        ]);

        const todaySales = todayDeals.reduce((sum, d) => sum + (d.quotedPrice || 0), 0);
        const todayProfit = todayDeals.reduce((sum, d) => sum + Math.max(0, (d.quotedPrice || 0) - (d.vendorPrice || 0)), 0);

        const totalSales = allDeals.reduce((sum, d) => sum + (d.quotedPrice || 0), 0);
        const totalProfit = allDeals.reduce((sum, d) => sum + Math.max(0, (d.quotedPrice || 0) - (d.vendorPrice || 0)), 0);

        const rawStatus = WhatsAppService.getStatus();

        res.json({
            success: true,
            data: {
                agentStatus: {
                    status: rawStatus.status,
                    isReady: rawStatus.status === 'READY',
                    loadingPercent: rawStatus.loadingPercent || 0,
                    loadingMessage: rawStatus.loadingMessage || '',
                    awaitingVendorCount
                },
                metrics: {
                    todayInquiries,
                    todayDeals: todayDeals.length,
                    todaySales,
                    todayProfit,
                    totalDeals: allDeals.length,
                    totalSales,
                    totalProfit,
                },
                inquiries: recentInquiries
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

export default router;
