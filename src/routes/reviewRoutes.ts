import { Router } from "express";
import { generateReviewApi, getReviewQrCode } from "../controllers/reviewController";

const router = Router();

// Public endpoint secured via review key parameter in body/header
router.post("/generate", generateReviewApi);

// QR Code endpoint
router.get("/qr", getReviewQrCode);

export default router;
