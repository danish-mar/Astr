import { Request, Response } from "express";
import { Product, ShopSettings } from "../models";
import { handleError } from "../utils";
import { getImageUrl } from "../utils/s3Service";
import QRCode from "qrcode";


export const getPublicShelf = async (req: Request, res: Response) => {
    try {
        const { productId } = req.params;

        const product = await Product.findOne({ productID: productId.toUpperCase() })
            .populate("category", "name")
            .populate("source", "name");

        if (!product) {
            return res.status(404).render("errors/404", {
                message: "Product not found or invalid ID",
                layout: false
            });
        }

        // Fetch Shop Settings for branding
        const shopSettings = await (ShopSettings as any).getSettings();

        // Generate QR link for the shelf
        const serverUrl = process.env.SERVER_URL || `${req.protocol}://${req.get("host")}`;
        const qrUrl = `${serverUrl}/product/${product.productID}`;
        const qrDataUrl = await QRCode.toDataURL(qrUrl, {
            color: {
                dark: "#1E3A8A", // Navy Blue theme
                light: "#FFFFFF"
            },
            width: 200,
            margin: 1
        });

        // Prepare images with full URLs
        const imageUrls = (product.images || []).map(img => getImageUrl(img));

        res.render("shelf", {
            product,
            shopSettings,
            qrDataUrl,
            imageUrls,
            getImageUrl,
            layout: false // Mobile shelf is independent
        });

    } catch (error) {
        return handleError(error, res);
    }
};
