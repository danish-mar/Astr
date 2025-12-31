import { Request, Response } from "express";
import Employee from "../models/Employee";
import Contact from "../models/Contact";
import Account from "../models/Account";
import { sendSuccess, sendError, sendPaginated, handleError } from "../utils";
import { validateRequiredFields, isValidObjectId } from "../utils";
import jwt from "jsonwebtoken";

// Generate JWT token
const generateToken = (id: string): string => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "secret", {
    expiresIn: (process.env.JWT_EXPIRE || "7d") as any,
  });
};

// Create a new employee
export const createEmployee = async (req: Request, res: Response) => {
  try {
    const { username, password, name, position, salaryConfig } = req.body;

    // Check if employee already exists
    const existingEmployee = await Employee.findOne({ username });
    if (existingEmployee) {
      return sendError(res, "Username already exists", 400);
    }

    const employee = new Employee({
      username,
      password,
      name,
      position,
      salaryConfig,
    });

    await employee.save();

    return sendSuccess(res, employee, "Employee created successfully", 201);
  } catch (error) {
    return handleError(error, res);
  }
};

// Get all employees
export const getAllEmployees = async (req: Request, res: Response) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    return sendSuccess(res, employees, "Employees retrieved successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Get employee by ID
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

// Update employee
export const updateEmployee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid employee ID", 400);
    }

    // Don't allow password update through this route
    delete updateData.password;

    const employee = await Employee.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!employee) {
      return sendError(res, "Employee not found", 404);
    }

    return sendSuccess(res, employee, "Employee updated successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Update employee password
export const updateEmployeePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const employeeId = (req as any).employee._id;

    const employee = await Employee.findById(employeeId).select("+password");
    if (!employee) {
      return sendError(res, "Employee not found", 404);
    }

    // Check if current password is correct
    const isMatch = await employee.comparePassword(currentPassword);
    if (!isMatch) {
      return sendError(res, "Incorrect current password", 400);
    }

    employee.password = newPassword;
    await employee.save();

    return sendSuccess(res, null, "Password updated successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Delete employee (Deactivate)
export const deleteEmployee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid employee ID", 400);
    }

    const employee = await Employee.findByIdAndUpdate(
      id,
      { isActive: false, status: "Resigned" },
      { new: true }
    );

    if (!employee) {
      return sendError(res, "Employee not found", 404);
    }

    return sendSuccess(res, employee, "Employee deactivated successfully");
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

    return sendSuccess(res, null, "Employee permanently deleted");
  } catch (error) {
    return handleError(error, res);
  }
};

// Login employee
export const loginEmployee = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    const employee = await Employee.findOne({ username }).select("+password");
    if (!employee) {
      return sendError(res, "Invalid credentials", 401);
    }

    if (employee.status !== "Active") {
      return sendError(res, "Account is deactivated", 403);
    }

    const isMatch = await employee.comparePassword(password);
    if (!isMatch) {
      return sendError(res, "Invalid credentials", 401);
    }

    // Update last login
    employee.lastLogin = new Date();
    await employee.save();

    const token = generateToken(employee._id.toString());

    return sendSuccess(
      res,
      {
        token,
        employee: {
          _id: employee._id,
          username: employee.username,
          name: employee.name,
          position: employee.position,
          permissions: employee.permissions,
        },
      },
      "Login successful"
    );
  } catch (error) {
    return handleError(error, res);
  }
};

// Get current employee
export const getCurrentEmployee = async (req: Request, res: Response) => {
  try {
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

// Get employee statistics
export const getEmployeeStats = async (req: Request, res: Response) => {
  try {
    const totalEmployees = await Employee.countDocuments();
    const activeEmployees = await Employee.countDocuments({ status: "Active" });
    const positions = await Employee.aggregate([
      { $group: { _id: "$position", count: { $sum: 1 } } },
    ]);

    return sendSuccess(
      res,
      {
        total: totalEmployees,
        active: activeEmployees,
        positions,
      },
      "Employee statistics retrieved successfully"
    );
  } catch (error) {
    return handleError(error, res);
  }
};

// Admin reset password for any user
export const adminResetPassword = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid employee ID", 400);
    }

    if (!newPassword || newPassword.length < 6) {
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

    employee.password = newPassword;
    await employee.save();

    return sendSuccess(
      res,
      null,
      `Password for ${employee.username} has been reset successfully`
    );
  } catch (error) {
    return handleError(error, res);
  }
};

// Update permissions for a user
export const updatePermissions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid employee ID", 400);
    }

    if (!Array.isArray(permissions)) {
      return sendError(res, "Permissions must be an array of strings", 400);
    }

    const employee = await Employee.findByIdAndUpdate(
      id,
      { permissions },
      { new: true, runValidators: true }
    );

    if (!employee) {
      return sendError(res, "Employee not found", 404);
    }

    return sendSuccess(res, employee, "Permissions updated successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Get detailed profile for admin view
export const getDetailedProfile = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid employee ID", 400);
    }

    const employee = await Employee.findById(id);

    if (!employee) {
      return sendError(res, "Employee not found", 404);
    }

    // You could aggregate logs/stats here in the future
    return sendSuccess(
      res,
      employee,
      "Detailed profile retrieved successfully"
    );
  } catch (error) {
    return handleError(error, res);
  }
};

// Sync employee to Accounting Ledger
export const syncEmployeeLedger = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid employee ID", 400);
    }

    const employee = await Employee.findById(id);
    if (!employee) {
      return sendError(res, "Employee not found", 404);
    }

    // 1. Check if contact exists for this employee (by type and name)
    let contact = await Contact.findOne({
      contactType: "Employee",
      name: employee.name,
      ...(employee.phone && { phone: employee.phone }),
    });

    if (!contact) {
      contact = await Contact.create({
        name: employee.name,
        phone: employee.phone || "",
        contactType: "Employee",
        notes: `System generated contact for employee: ${employee.username}`,
      });
    }

    // 2. Check if account exists
    let account = await Account.findOne({
      contact: contact._id,
      accountName: `${employee.name} (Salary Payable)`,
    });
    if (!account) {
      account = await Account.create({
        contact: contact._id,
        accountName: `${employee.name} (Salary Payable)`,
        accountType: "Payable",
        description: `Salary payable ledger for ${employee.name}`,
        totalBalance: 0,
      });
    }

    // 3. Link account to employee
    employee.accountId = account._id as any;
    await employee.save();

    return sendSuccess(
      res,
      { employee, account },
      "Employee synchronized with accounting ledger"
    );
  } catch (error) {
    return handleError(error, res);
  }
};

// Update employee professional status (Resigned, Suspended, Active)
export const updateEmployeeStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid employee ID", 400);
    }

    if (!["Active", "Resigned", "Suspended"].includes(status)) {
      return sendError(res, "Invalid status value", 400);
    }

    const employee = await Employee.findById(id);
    if (!employee) {
      return sendError(res, "Employee not found", 404);
    }

    employee.status = status;
    // If resigned or suspended, deactivate login
    if (status !== "Active") {
      employee.isActive = false;
    } else {
      employee.isActive = true;
    }

    await employee.save();

    return sendSuccess(res, employee, `Employee status updated to ${status}`);
  } catch (error) {
    return handleError(error, res);
  }
};

// Update employee organizational group
export const updateEmployeeGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { group } = req.body;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid employee ID", 400);
    }

    const employee = await Employee.findByIdAndUpdate(
      id,
      { group },
      { new: true }
    );
    if (!employee) {
      return sendError(res, "Employee not found", 404);
    }

    return sendSuccess(res, employee, "Employee group updated successfully");
  } catch (error) {
    return handleError(error, res);
  }
};
