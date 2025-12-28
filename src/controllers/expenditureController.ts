import { Request, Response } from "express";
import { Expenditure } from "../models";
import { sendSuccess, sendError, handleError } from "../utils";
import { AuthRequest } from "../middleware/auth";

/**
 * @desc Get all expenditures with filtering
 * @route GET /api/v1/expenditures
 * @access Private
 */
export const getAllExpenditures = async (req: Request, res: Response) => {
    try {
        const { category, startDate, endDate, search } = req.query;
        const filter: any = {};

        if (category) filter.category = category;

        if (startDate || endDate) {
            filter.date = {};
            if (startDate) filter.date.$gte = new Date(startDate as string);
            if (endDate) filter.date.$lte = new Date(endDate as string);
        }

        if (search) {
            filter.title = { $regex: search, $options: "i" };
        }

        const expenditures = await Expenditure.find(filter)
            .populate("addedBy", "name email")
            .sort({ date: -1, createdAt: -1 });

        return sendSuccess(res, expenditures, "Expenditures retrieved successfully");
    } catch (error) {
        return handleError(error, res);
    }
};

/**
 * @desc Create new expenditure
 * @route POST /api/v1/expenditures
 * @access Private
 */
export const createExpenditure = async (req: AuthRequest, res: Response) => {
    try {
        const { title, amount, category, date, description } = req.body;

        const expenditure = await Expenditure.create({
            title,
            amount,
            category,
            date: date || new Date(),
            description,
            addedBy: req.employee?._id,
        });

        return sendSuccess(res, expenditure, "Expenditure logged successfully", 201);
    } catch (error) {
        return handleError(error, res);
    }
};

/**
 * @desc Update expenditure
 * @route PATCH /api/v1/expenditures/:id
 * @access Private
 */
export const updateExpenditure = async (req: Request, res: Response) => {
    try {
        const expenditure = await Expenditure.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });

        if (!expenditure) {
            return sendError(res, "No expenditure found with that ID", 404);
        }

        return sendSuccess(res, expenditure, "Expenditure updated successfully");
    } catch (error) {
        return handleError(error, res);
    }
};

/**
 * @desc Delete expenditure
 * @route DELETE /api/v1/expenditures/:id
 * @access Private
 */
export const deleteExpenditure = async (req: Request, res: Response) => {
    try {
        const expenditure = await Expenditure.findByIdAndDelete(req.params.id);

        if (!expenditure) {
            return sendError(res, "No expenditure found with that ID", 404);
        }

        return sendSuccess(res, null, "Expenditure deleted successfully", 204);
    } catch (error) {
        return handleError(error, res);
    }
};

/**
 * @desc Get expenditure statistics
 * @route GET /api/v1/expenditures/stats
 * @access Private
 */
export const getExpenditureStats = async (req: Request, res: Response) => {
    try {
        const stats = await Expenditure.aggregate([
            {
                $group: {
                    _id: "$category",
                    totalAmount: { $sum: "$amount" },
                    count: { $sum: 1 },
                },
            },
            { $sort: { totalAmount: -1 } },
        ]);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dailyTotal = await Expenditure.aggregate([
            { $match: { date: { $gte: today } } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);

        return sendSuccess(res, {
            byCategory: stats,
            todayTotal: dailyTotal[0]?.total || 0,
        }, "Expenditure statistics retrieved successfully");
    } catch (error) {
        return handleError(error, res);
    }
};
