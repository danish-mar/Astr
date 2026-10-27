import { Request, Response } from "express";
import aiService from "../services/aiService";
import assistantService from "../services/assistantService";
import Product from "../models/Product";
import ShopSettings from "../models/ShopSettings";
import { handleError, sendSuccess } from "../utils";

/**
 * Generate product advertisement messages
 * POST /api/v1/ai/generate-product-ad
 */
export const generateProductAd = async (req: Request, res: Response) => {
    try {
        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required",
            });
        }

        // Fetch product details
        const product = await Product.findById(productId).populate('category', 'name');

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        // Prepare product data for AI
        const productData = {
            name: product.name,
            category: (product.category as any)?.name || 'General',
            price: product.price,
            specifications: product.specifications ? Object.fromEntries(product.specifications) : {},
            tags: product.tags,
        };

        // Generate ads using AI service
        const ads = await aiService.generateProductAd(productData);

        return sendSuccess(res, {
            product: {
                id: product._id,
                name: product.name,
                price: product.price,
            },
            messages: ads,
        }, "Advertisement generated successfully");

    } catch (error: any) {
        console.error("Generate Product Ad Error:", error);

        // Handle specific AI errors
        if (error.message.includes('AI is not configured')) {
            return res.status(400).json({
                success: false,
                message: "AI is not configured. Please set up AI in Settings first.",
                code: "AI_NOT_CONFIGURED",
            });
        }

        if (error.message.includes('API key')) {
            return res.status(400).json({
                success: false,
                message: "Invalid or missing API key. Please check your AI settings.",
                code: "INVALID_API_KEY",
            });
        }

        return handleError(error, res);
    }
};

/**
 * Test AI connection
 * POST /api/v1/ai/test-connection
 */
export const testConnection = async (req: Request, res: Response) => {
    try {
        const { provider, baseUrl, apiKey, model } = req.body || {};
        const result = await aiService.testConnection({ provider, baseUrl, apiKey, model });

        if (result.success) {
            return sendSuccess(res, {
                provider: result.provider,
            }, result.message);
        } else {
            return res.status(400).json({
                success: false,
                message: result.message,
            });
        }
    } catch (error) {
        return handleError(error, res);
    }
};

/**
 * Fetch models from OpenAI compatible endpoint / provider
 * POST /api/v1/ai/models
 */
export const getModels = async (req: Request, res: Response) => {
    try {
        const { provider, baseUrl, apiKey } = req.body || {};
        const models = await aiService.fetchModels({ provider, baseUrl, apiKey });
        return sendSuccess(res, { models }, "Models retrieved successfully");
    } catch (error: any) {
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to fetch models",
        });
    }
};

/**
 * Chat with AI Copilot / Assistant
 * POST /api/v1/ai/chat
 */
export const chatWithAssistant = async (req: Request, res: Response) => {
    try {
        const { message, history } = req.body;

        if (!message || typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: "A prompt or message is required.",
            });
        }

        const result = await assistantService.processChat(message.trim(), history || []);
        return sendSuccess(res, result);
    } catch (error: any) {
        console.error("Assistant Chat Error:", error);
        return handleError(error, res);
    }
};

/**
 * Get AI Assistant Status (configured provider and readiness)
 * GET /api/v1/ai/status
 */
export const getAssistantStatus = async (req: Request, res: Response) => {
    try {
        const settings = await ShopSettings.getSettings();
        const isConfigured = Boolean(
            settings.aiProvider &&
            settings.aiProvider !== "none" &&
            (settings.aiProvider === "custom" || settings.aiApiKey)
        );

        return sendSuccess(res, {
            isConfigured,
            provider: settings.aiProvider || "none",
            model: settings.aiModel || "Default",
            shopName: settings.shopName,
        });
    } catch (error) {
        return handleError(error, res);
    }
};


