import { Request, Response } from "express";
import ShopSettings from "../models/ShopSettings";
import aiService from "../services/aiService";
import QRCode from "qrcode";
import { handleError, sendSuccess, sendError } from "../utils";

/**
 * Render the public/semi-public review generator page
 * GET /reviews?key=<password>
 */
export const renderReviewPage = async (req: Request, res: Response) => {
    try {
        const settings = await ShopSettings.getSettings();
        const configuredKey = (settings.reviewAccessKey || "review123").trim();
        const providedKey = ((req.query.key as string) || "").trim();

        const isAuthorized = !configuredKey || providedKey === configuredKey;

        const reviewUrl = settings.reviewUrl || "https://g.page/r/your-google-review-link";
        const rawIg = (settings.instagramUsername || "").trim();
        const cleanIg = rawIg.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "").trim();
        const instagramUrl = cleanIg ? `https://www.instagram.com/${cleanIg}` : "";

        return res.render("reviews", {
            layout: false,
            title: `${settings.shopName || "Astr"} - Customer Review`,
            shopName: settings.shopName || "Astr Tech Shop",
            logo: settings.logo,
            isAuthorized,
            providedKey,
            reviewUrl,
            instagramUsername: cleanIg,
            instagramUrl,
            themeColor: settings.themeColor || "#3B82F6",
        });
    } catch (error) {
        return handleError(error, res);
    }
};

/**
 * Handle Instagram follow redirect page
 * GET /instagram or GET /ig
 */
export const handleInstagramRedirect = async (req: Request, res: Response) => {
    try {
        const settings = await ShopSettings.getSettings();
        const rawIg = (settings.instagramUsername || "").trim();
        const cleanIg = rawIg.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "").trim();

        if (!cleanIg) {
            return res.redirect("https://www.instagram.com");
        }

        const instagramUrl = `https://www.instagram.com/${cleanIg}`;
        const appDeepLink = `instagram://user?username=${cleanIg}`;

        return res.render("instagram-redirect", {
            layout: false,
            title: `Follow ${settings.shopName || "Astr"} on Instagram`,
            shopName: settings.shopName || "Astr",
            username: cleanIg,
            instagramUrl,
            appDeepLink,
            logo: settings.logo,
            themeColor: settings.themeColor || "#3B82F6",
        });
    } catch (error) {
        return handleError(error, res);
    }
};

/**
 * API endpoint to generate review
 * POST /api/v1/reviews/generate
 */
export const generateReviewApi = async (req: Request, res: Response) => {
    try {
        const { key, type, prompt } = req.body || {};
        const settings = await ShopSettings.getSettings();
        const configuredKey = (settings.reviewAccessKey || "review123").trim();

        if (configuredKey && key !== configuredKey) {
            return sendError(res, "Access denied. Invalid or missing key.", 401);
        }

        const reviewType = type === "custom" ? "custom" : "random";
        const review = await aiService.generateReview({
            type: reviewType,
            customPrompt: prompt,
            shopName: settings.shopName,
        });

        return sendSuccess(res, { review }, "Review generated successfully");
    } catch (error) {
        return handleError(error, res);
    }
};

/**
 * API endpoint to get Review Page QR code
 * GET /api/v1/settings/review-qr
 */
export const getReviewQrCode = async (req: Request, res: Response) => {
    try {
        const settings = await ShopSettings.getSettings();
        const configuredKey = (settings.reviewAccessKey || "review123").trim();
        const serverUrl = process.env.SERVER_URL || `${req.protocol}://${req.get("host")}`;
        const targetUrl = `${serverUrl}/reviews?key=${encodeURIComponent(configuredKey)}`;

        const qrDataUrl = await QRCode.toDataURL(targetUrl, {
            color: {
                dark: "#0F172A",
                light: "#FFFFFF",
            },
            width: 320,
            margin: 2,
        });

        return sendSuccess(res, {
            qrDataUrl,
            targetUrl,
            reviewUrl: settings.reviewUrl || "https://g.page/r/your-google-review-link",
            reviewAccessKey: configuredKey,
        }, "QR generated successfully");
    } catch (error) {
        return handleError(error, res);
    }
};
