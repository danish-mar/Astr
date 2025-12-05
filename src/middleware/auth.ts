import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import Employee from "../models/Employee";
import { sendError } from "../utils";

// Extend Express Request to include employee
export interface AuthRequest extends Request {
  employee?: any;
}

// Verify JWT token
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get token from header
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return sendError(res, "Access denied. No token provided", 401);
    }

    // Verify token
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "secret");

    // Find employee
    const employee = await Employee.findById(decoded.id);

    if (!employee) {
      return sendError(res, "Invalid token. Employee not found", 401);
    }

    if (!employee.isActive) {
      return sendError(res, "Account is deactivated", 403);
    }

    // Attach employee to request
    req.employee = employee;
    next();
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      return sendError(res, "Token expired", 401);
    }
    return sendError(res, "Invalid token", 401);
  }
};

// Check if employee has specific position
export const authorize = (...positions: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.employee) {
      return sendError(res, "Authentication required", 401);
    }

    if (!positions.includes(req.employee.position)) {
      return sendError(
        res,
        `Access denied. Required position: ${positions.join(" or ")}`,
        403
      );
    }

    next();
  };
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (token) {
      const decoded: any = jwt.verify(
        token,
        process.env.JWT_SECRET || "secret"
      );
      const employee = await Employee.findById(decoded.id);

      if (employee && employee.isActive) {
        req.employee = employee;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};
