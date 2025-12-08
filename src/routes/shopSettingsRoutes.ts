import { Router } from "express";
import {
  getSettings,
  updateSettings,
} from "../controllers/shopSettingsController";
import { authenticate as protect, authorize } from "../middleware/auth";

const router = Router();

// Protect all routes
router.use(protect);

router.get("/", getSettings);
router.put("/", authorize("Admin", "CEO", "Manager"), updateSettings);

export default router;
