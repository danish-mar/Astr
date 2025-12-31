import { Router } from "express";
import {
    getDashboardStats,
    getDetailedStats,
} from "../controllers/statisticsController";
import { authenticate as protect, requirePermission } from "../middleware/auth";

const router = Router();

// Protect all routes
router.use(protect);

router.get("/dashboard", getDashboardStats);
router.get("/detailed", requirePermission("accounting:read"), getDetailedStats);

export default router;
