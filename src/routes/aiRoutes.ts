import { Router } from "express";
import { generateProductAd, testConnection, getModels, chatWithAssistant, getAssistantStatus } from "../controllers/aiController";
import { authenticate as protect, requirePermission } from "../middleware/auth";

const router = Router();

// Protect all AI routes
router.use(protect);

// AI Assistant Chat & Status
router.post("/chat", chatWithAssistant);
router.get("/status", getAssistantStatus);

// Generate product advertisement
router.post("/generate-product-ad", requirePermission("products:write"), generateProductAd);

// Test AI connection
router.post("/test-connection", requirePermission("ai:manage"), testConnection);

// Fetch models list from endpoint / provider
router.post("/models", requirePermission("ai:manage"), getModels);

export default router;
