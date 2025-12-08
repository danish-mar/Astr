import { Router } from "express";
import {
    getDashboardStats,
    getDetailedStats,
} from "../controllers/statisticsController";
import { authenticate as protect, authorize } from "../middleware/auth";

const router = Router();

// Protect all routes
router.use(protect);

router.get("/dashboard", getDashboardStats);
router.get("/detailed", authorize("Admin", "CEO", "Manager"), getDetailedStats);

export default router;
