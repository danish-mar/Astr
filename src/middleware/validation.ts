import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils";

// Validate request body has required fields
export const validateFields = (requiredFields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const missing: string[] = [];

    requiredFields.forEach((field) => {
      if (
        !req.body[field] ||
        (typeof req.body[field] === "string" && req.body[field].trim() === "")
      ) {
        missing.push(field);
      }
    });

    if (missing.length > 0) {
      return sendError(
        res,
        `Missing required fields: ${missing.join(", ")}`,
        400
      );
    }

    next();
  };
};

// Validate MongoDB ObjectId
export const validateObjectId = (paramName: string = "id") => {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = req.params[paramName];

    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      return sendError(res, `Invalid ${paramName}`, 400);
    }

    next();
  };
};
