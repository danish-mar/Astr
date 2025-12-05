import { Request, Response } from "express";
import Employee from "../models/Employee";
import { sendSuccess, sendError, sendPaginated, handleError } from "../utils";
import { validateRequiredFields, isValidObjectId } from "../utils";
import jwt from "jsonwebtoken";

// Generate JWT token
const generateToken = (id: string): string => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "secret", {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  } as jwt.SignOptions);
};

// Get all employees with filtering and pagination
export const getAllEmployees = async (req: Request, res: Response) => {
  try {
    const { position, isActive, search, page = 1, limit = 10 } = req.query;

    const filter: any = {};

    // Filter by position
    if (position && position !== "All") {
      filter.position = position;
    }

    // Filter by active status
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    // Search by name or username
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const employees = await Employee.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Employee.countDocuments(filter);

    return sendPaginated(
      res,
      employees,
      pageNum,
      limitNum,
      total,
      "Employees retrieved successfully"
    );
  } catch (error) {
    return handleError(error, res);
  }
};

// Get single employee by ID
export const getEmployeeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid employee ID", 400);
    }

    const employee = await Employee.findById(id);

    if (!employee) {
      return sendError(res, "Employee not found", 404);
    }

    return sendSuccess(res, employee, "Employee retrieved successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Create new employee
export const createEmployee = async (req: Request, res: Response) => {
  try {
    const { username, password, name, position, email, phone } = req.body;

    // Validate required fields
    const missing = validateRequiredFields(req.body, [
      "username",
      "password",
      "name",
      "position",
    ]);
    if (missing.length > 0) {
      return sendError(
        res,
        `Missing required fields: ${missing.join(", ")}`,
        400
      );
    }

    // Check if username already exists
    const existingEmployee = await Employee.findOne({
      username: username.toLowerCase(),
    });
    if (existingEmployee) {
      return sendError(res, "Username already exists", 409);
    }

    // Create employee
    const employee = new Employee({
      username: username.toLowerCase(),
      password,
      name,
      position,
      email,
      phone,
    });

    await employee.save();

    return sendSuccess(res, employee, "Employee created successfully", 201);
  } catch (error) {
    return handleError(error, res);
  }
};

// Update employee
export const updateEmployee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, position, email, phone, isActive } = req.body;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid employee ID", 400);
    }

    const employee = await Employee.findById(id);

    if (!employee) {
      return sendError(res, "Employee not found", 404);
    }

    // Update fields (username and password not updatable here)
    if (name) employee.name = name;
    if (position) employee.position = position;
    if (email !== undefined) employee.email = email;
    if (phone !== undefined) employee.phone = phone;
    if (isActive !== undefined) employee.isActive = isActive;

    await employee.save();

    return sendSuccess(res, employee, "Employee updated successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Update employee password
export const updateEmployeePassword = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid employee ID", 400);
    }

    // Validate required fields
    const missing = validateRequiredFields(req.body, [
      "currentPassword",
      "newPassword",
    ]);
    if (missing.length > 0) {
      return sendError(
        res,
        `Missing required fields: ${missing.join(", ")}`,
        400
      );
    }

    if (newPassword.length < 6) {
      return sendError(
        res,
        "New password must be at least 6 characters long",
        400
      );
    }

    const employee = await Employee.findById(id).select("+password");

    if (!employee) {
      return sendError(res, "Employee not found", 404);
    }

    // Verify current password
    const isMatch = await employee.comparePassword(currentPassword);
    if (!isMatch) {
      return sendError(res, "Current password is incorrect", 401);
    }

    // Update password
    employee.password = newPassword;
    await employee.save();

    return sendSuccess(res, null, "Password updated successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Delete employee (soft delete - set isActive to false)
export const deleteEmployee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid employee ID", 400);
    }

    const employee = await Employee.findById(id);

    if (!employee) {
      return sendError(res, "Employee not found", 404);
    }

    // Soft delete - set isActive to false
    employee.isActive = false;
    await employee.save();

    return sendSuccess(res, null, "Employee deactivated successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Permanently delete employee
export const permanentlyDeleteEmployee = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid employee ID", 400);
    }

    const employee = await Employee.findByIdAndDelete(id);

    if (!employee) {
      return sendError(res, "Employee not found", 404);
    }

    return sendSuccess(res, null, "Employee permanently deleted successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Employee login (REPLACE EXISTING FUNCTION)
export const loginEmployee = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // Validate required fields
    const missing = validateRequiredFields(req.body, ["username", "password"]);
    if (missing.length > 0) {
      return sendError(
        res,
        `Missing required fields: ${missing.join(", ")}`,
        400
      );
    }

    // Authenticate employee
    const employeeData = await Employee.authenticate(
      username.toLowerCase(),
      password
    );

    if (!employeeData) {
      return sendError(res, "Invalid username or password", 401);
    }

    // Generate JWT token
    const token = generateToken(employeeData._id.toString());

    return sendSuccess(
      res,
      {
        employee: employeeData,
        token,
      },
      "Login successful"
    );
  } catch (error) {
    return handleError(error, res);
  }
};

// Get employee statistics
export const getEmployeeStats = async (req: Request, res: Response) => {
  try {
    const total = await Employee.countDocuments();
    const active = await Employee.countDocuments({ isActive: true });
    const inactive = await Employee.countDocuments({ isActive: false });

    const byPosition = await Employee.aggregate([
      {
        $match: { isActive: true },
      },
      {
        $group: {
          _id: "$position",
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {
      total,
      active,
      inactive,
      byPosition: byPosition.reduce((acc: any, curr: any) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
    };

    return sendSuccess(
      res,
      result,
      "Employee statistics retrieved successfully"
    );
  } catch (error) {
    return handleError(error, res);
  }
};

// Get current logged-in employee
export const getCurrentEmployee = async (req: Request, res: Response) => {
  try {
    // Employee is already attached by auth middleware
    const employee = (req as any).employee;

    return sendSuccess(
      res,
      employee,
      "Current employee retrieved successfully"
    );
  } catch (error) {
    return handleError(error, res);
  }
};
