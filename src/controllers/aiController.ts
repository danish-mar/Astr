import { Request, Response } from "express";
import aiService from "../services/aiService";
import Product from "../models/Product";
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
        const result = await aiService.testConnection();

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
