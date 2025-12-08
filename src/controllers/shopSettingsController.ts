import { Request, Response } from "express";
import ShopSettings from "../models/ShopSettings";
import { handleError, sendSuccess } from "../utils";

export const getSettings = async (req: Request, res: Response) => {
  try {
    const settings = await ShopSettings.getSettings();
    return sendSuccess(res, { settings }, "Settings fetched successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const settings = await ShopSettings.updateSettings(updates);
    return sendSuccess(res, { settings }, "Settings updated successfully");
  } catch (error) {
    return handleError(error, res);
  }
};
