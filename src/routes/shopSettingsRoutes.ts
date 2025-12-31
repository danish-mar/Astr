import { Router } from "express";
import {
  getSettings,
  updateSettings,
} from "../controllers/shopSettingsController";
import { authenticate as protect, requirePermission } from "../middleware/auth";

const router = Router();

// Protect all routes
router.use(protect);

router.get("/", getSettings);
router.put("/", requirePermission("settings:manage"), updateSettings);

export default router;
