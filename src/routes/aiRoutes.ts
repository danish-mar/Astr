import { Router } from "express";
import { generateProductAd, testConnection } from "../controllers/aiController";
import { authenticate as protect, requirePermission } from "../middleware/auth";

const router = Router();

// Protect all AI routes
router.use(protect);

// Generate product advertisement
router.post("/generate-product-ad", requirePermission("products:write"), generateProductAd);

// Test AI connection
router.post("/test-connection", requirePermission("ai:manage"), testConnection);

export default router;
