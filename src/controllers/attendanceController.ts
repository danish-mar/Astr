import { Request, Response } from "express";
import Attendance from "../models/Attendance";
import Employee from "../models/Employee";
import { sendSuccess, sendError, handleError } from "../utils";
import mongoose from "mongoose";

// Check-in
export const checkIn = async (req: Request, res: Response) => {
    try {
        const employeeId = (req as any).employee._id;
        const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

        // Check if already checked in today
        let attendance = await Attendance.findOne({ employee: employeeId, date });

        if (attendance && attendance.checkIn) {
            return sendError(res, "Already checked in for today", 400);
        }

        if (!attendance) {
            attendance = new Attendance({
                employee: employeeId,
                date,
                checkIn: new Date(),
                status: "present",
            });
        } else {
            attendance.checkIn = new Date();
            attendance.status = "present";
        }

        await attendance.save();

        return sendSuccess(res, attendance, "Checked in successfully");
    } catch (error) {
        return handleError(error, res);
    }
};

// Check-out
export const checkOut = async (req: Request, res: Response) => {
    try {
        const employeeId = (req as any).employee._id;
        const date = new Date().toISOString().split("T")[0];

        const attendance = await Attendance.findOne({ employee: employeeId, date });

        if (!attendance || !attendance.checkIn) {
            return sendError(res, "You must check in first", 400);
        }

        if (attendance.checkOut) {
            return sendError(res, "Already checked out for today", 400);
        }

        attendance.checkOut = new Date();
        await attendance.save();

        return sendSuccess(res, attendance, "Checked out successfully");
    } catch (error) {
        return handleError(error, res);
    }
};

// Get attendance status for today
export const getTodayStatus = async (req: Request, res: Response) => {
    try {
        const employeeId = (req as any).employee._id;
        const date = new Date().toISOString().split("T")[0];

        const attendance = await Attendance.findOne({ employee: employeeId, date });

        return sendSuccess(res, attendance, "Today's status retrieved");
    } catch (error) {
        return handleError(error, res);
    }
};

// Get attendance history (Self or Admin)
export const getAttendanceHistory = async (req: Request, res: Response) => {
    try {
        const { id } = req.params; // Optional employee ID for admin
        const employeeId = id || (req as any).employee._id;

        const history = await Attendance.find({ employee: employeeId })
            .sort({ date: -1 })
            .limit(30);

        return sendSuccess(res, history, "Attendance history retrieved");
    } catch (error) {
        return handleError(error, res);
    }
};

// Calculate Payroll (Admin only)
export const calculatePayroll = async (req: Request, res: Response) => {
    try {
        const { month, year, employeeId } = req.query;

        if (!month || !year || !employeeId) {
            return sendError(res, "Month, year, and employeeId are required", 400);
        }

        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return sendError(res, "Employee not found", 404);
        }

        // Find all attendance records for this month
        const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
        const endDate = `${year}-${String(month).padStart(2, "0")}-31`;

        const records = await Attendance.find({
            employee: employeeId,
            date: { $gte: startDate, $lte: endDate },
            status: "present",
        });

        const daysPresent = records.length;
        let earnedSalary = 0;

        if (employee.salaryConfig.type === "daily") {
            earnedSalary = daysPresent * employee.salaryConfig.amount;
        } else {
            // Simple monthly calculation: (Monthly Amount / 30) * days present
            earnedSalary = (employee.salaryConfig.amount / 30) * daysPresent;
        }

        return sendSuccess(
            res,
            {
                employee: employee.name,
                daysPresent,
                earnedSalary: Math.round(earnedSalary),
                config: employee.salaryConfig,
            },
            "Payroll calculated successfully"
        );
    } catch (error) {
        return handleError(error, res);
    }
};

// Get list of employees who checked in today (for Aura effect)
export const getTodayActiveEmployees = async (req: Request, res: Response) => {
    try {
        const date = new Date().toISOString().split("T")[0];
        const records = await Attendance.find({
            date,
            checkIn: { $exists: true },
        }).select("employee");
        const activeIds = records.map((r) => r.employee);
        return sendSuccess(res, activeIds, "Active employees retrieved");
    } catch (error) {
        return handleError(error, res);
    }
};
