import { Router } from "express";
import {
  getShopSettings,
  updateShopSettings,
} from "../controllers/shopSettingsController";
import { authenticate, authorize } from "../middleware";

const router = Router();

// Public route (can be viewed by anyone)
router.get("/", getShopSettings);

// Protected route (Admin, CEO only)
router.put("/", authenticate, authorize("Admin", "CEO"), updateShopSettings);

export default router;
