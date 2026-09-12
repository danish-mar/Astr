import { Request, Response } from "express";
import ShopSettings from "../models/ShopSettings";
import aiService from "../services/aiService";
import { handleError, sendSuccess } from "../utils";

export const getSettings = async (req: Request, res: Response) => {
  try {
    const settings = await ShopSettings.getSettings();
    const settingsWithKey = await ShopSettings.findOne().select('+aiApiKey');
    const hasAiApiKey = !!(settingsWithKey && settingsWithKey.aiApiKey);
    const settingsObj = settings.toObject();

    return sendSuccess(res, { 
      settings: {
        ...settingsObj,
        hasAiApiKey
      } 
    }, "Settings fetched successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const settings = await ShopSettings.updateSettings(updates);
    
    // Trigger queue refill in background with updated settings
    if (settings.aiEnabled && settings.aiProvider !== 'none') {
      aiService.initReviewQueue(settings.shopName).catch(err => console.warn(err));
    }

    return sendSuccess(res, { settings }, "Settings updated successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

