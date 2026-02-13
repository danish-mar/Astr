import { Router } from 'express';
import WhatsAppService from '../services/WhatsAppService';
import { authenticate as protect, requirePermission } from '../middleware/auth';

const router = Router();

// Protect all routes
router.use(protect);
router.use(requirePermission('settings:manage'));

// Get WhatsApp status and QR code
router.get('/status', (req, res) => {
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
router.post('/initialize', async (req, res) => {
    try {
        await WhatsAppService.reinitialize();
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
router.post('/logout', async (req, res) => {
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

export default router;
