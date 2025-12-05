import { Request, Response } from "express";
import ShopSettings from "../models/ShopSettings";
import { sendSuccess, sendError, handleError } from "../utils";

// Get shop settings
export const getShopSettings = async (req: Request, res: Response) => {
  try {
    const settings = await ShopSettings.getSettings();

    return sendSuccess(res, settings, "Shop settings retrieved successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Update shop settings
export const updateShopSettings = async (req: Request, res: Response) => {
  try {
    const { shopName, address, phone, email, logo } = req.body;

    const updates: any = {};

    if (shopName) updates.shopName = shopName;
    if (address !== undefined) updates.address = address;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (logo !== undefined) updates.logo = logo;

    const settings = await ShopSettings.updateSettings(updates);

    return sendSuccess(res, settings, "Shop settings updated successfully");
  } catch (error) {
    return handleError(error, res);
  }
};
