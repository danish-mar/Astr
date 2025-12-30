import { Request, Response } from "express";
import { Expenditure, Tag } from "../models";
import { sendSuccess, sendError, handleError } from "../utils";
import { AuthRequest } from "../middleware/auth";
import mongoose from "mongoose";

/**
 * @desc Get all expenditures with filtering
 * @route GET /api/v1/expenditures
 * @access Private
 */
export const getAllExpenditures = async (req: Request, res: Response) => {
    try {
        const { tagId, period, startDate, endDate, search } = req.query;
        const filter: any = {};

        if (tagId) filter.tag = tagId;

        // Advanced Time Filtering
        const now = new Date();
        if (period === 'day') {
            const startOfDay = new Date(now.setHours(0, 0, 0, 0));
            filter.date = { $gte: startOfDay };
        } else if (period === 'month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            filter.date = { $gte: startOfMonth };
        } else if (period === 'year') {
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            filter.date = { $gte: startOfYear };
        } else if (startDate || endDate) {
            filter.date = {};
            if (startDate) filter.date.$gte = new Date(startDate as string);
            if (endDate) filter.date.$lte = new Date(endDate as string);
        }

        if (search) {
            filter.title = { $regex: search, $options: "i" };
        }

        const expenditures = await Expenditure.find(filter)
            .populate("addedBy", "name email")
            .populate("tag")
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
        const { title, amount, tagId, date, description, newTagName } = req.body;

        let finalTagId = tagId;

        // Support for creating a new tag on the fly
        if (newTagName) {
            let tag = await Tag.findOne({ name: newTagName });
            if (!tag) {
                tag = await Tag.create({ name: newTagName });
            }
            finalTagId = tag._id;
        }

        const expenditure = await Expenditure.create({
            title,
            amount,
            tag: finalTagId,
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
        const { tagId, ...updateData } = req.body;
        if (tagId) updateData.tag = tagId;

        const expenditure = await Expenditure.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true,
        }).populate("tag");

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
        const { period } = req.query;
        const match: any = {};

        const now = new Date();
        if (period === 'day') {
            match.date = { $gte: new Date(now.setHours(0, 0, 0, 0)) };
        } else if (period === 'month') {
            match.date = { $gte: new Date(now.getFullYear(), now.getMonth(), 1) };
        } else if (period === 'year') {
            match.date = { $gte: new Date(now.getFullYear(), 0, 1) };
        }

        const statsByTag = await Expenditure.aggregate([
            { $match: match },
            {
                $group: {
                    _id: "$tag",
                    totalAmount: { $sum: "$amount" },
                    count: { $sum: 1 },
                },
            },
            {
                $lookup: {
                    from: "tags",
                    localField: "_id",
                    foreignField: "_id",
                    as: "tagInfo"
                }
            },
            { $unwind: { path: "$tagInfo", preserveNullAndEmptyArrays: true } },
            { $sort: { totalAmount: -1 } },
        ]);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dailyTotal = await Expenditure.aggregate([
            { $match: { date: { $gte: today } } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);

        return sendSuccess(res, {
            byTag: statsByTag,
            todayTotal: dailyTotal[0]?.total || 0,
        }, "Expenditure statistics retrieved successfully");
    } catch (error) {
        return handleError(error, res);
    }
};

/**
 * @desc Get all expenditure tags
 * @route GET /api/v1/expenditures/tags
 * @access Private
 */
export const getAllTags = async (req: Request, res: Response) => {
    try {
        const tags = await Tag.find().sort({ name: 1 });
        return sendSuccess(res, tags, "Tags retrieved successfully");
    } catch (error) {
        return handleError(error, res);
    }
};
