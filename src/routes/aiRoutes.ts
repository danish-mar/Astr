import { Router } from "express";
import { generateProductAd, testConnection } from "../controllers/aiController";
import { authenticate as protect } from "../middleware/auth";

const router = Router();

// Protect all AI routes
router.use(protect);

// Generate product advertisement
router.post("/generate-product-ad", generateProductAd);

// Test AI connection
router.post("/test-connection", testConnection);

export default router;
