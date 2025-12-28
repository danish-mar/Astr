import { Request, Response } from "express";
import { Lead, Contact, Product } from "../models";
import { sendSuccess, sendError, sendPaginated, handleError } from "../utils";
import { validateRequiredFields, isValidObjectId } from "../utils";

// Get all leads with filtering and pagination
export const getAllLeads = async (req: Request, res: Response) => {
    try {
        const {
            status,
            customer,
            product,
            search,
            page = 1,
            limit = 10,
        } = req.query;

        const filter: any = {};

        if (status && status !== "All") {
            filter.status = status;
        }

        if (customer && isValidObjectId(customer as string)) {
            filter.customer = customer;
        }

        if (product && isValidObjectId(product as string)) {
            filter.product = product;
        }

        if (search) {
            filter.$or = [
                { leadID: { $regex: search, $options: "i" } },
                { notes: { $regex: search, $options: "i" } },
                { source: { $regex: search, $options: "i" } },
            ];
        }

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const leads = await Lead.find(filter)
            .populate("customer", "name phone companyName")
            .populate("product", "name productID price")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        const total = await Lead.countDocuments(filter);

        return sendPaginated(
            res,
            leads,
            pageNum,
            limitNum,
            total,
            "Leads retrieved successfully"
        );
    } catch (error) {
        return handleError(error, res);
    }
};

// Get single lead by ID
export const getLeadById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return sendError(res, "Invalid lead ID", 400);
        }

        const lead = await Lead.findById(id)
            .populate("customer")
            .populate("product");

        if (!lead) {
            return sendError(res, "Lead not found", 404);
        }

        return sendSuccess(res, lead, "Lead retrieved successfully");
    } catch (error) {
        return handleError(error, res);
    }
};

// Create new lead
export const createLead = async (req: Request, res: Response) => {
    try {
        const { customer, product, status, estimatedValue, source, notes } = req.body;

        const missing = validateRequiredFields(req.body, ["customer", "product"]);
        if (missing.length > 0) {
            return sendError(res, `Missing required fields: ${missing.join(", ")}`, 400);
        }

        if (!isValidObjectId(customer)) {
            return sendError(res, "Invalid customer ID", 400);
        }

        if (!isValidObjectId(product)) {
            return sendError(res, "Invalid product ID", 400);
        }

        const customerDoc = await Contact.findById(customer);
        if (!customerDoc) return sendError(res, "Customer not found", 404);
        if (customerDoc.contactType !== "Customer") {
            return sendError(res, 'Selected contact must be of type "Customer"', 400);
        }

        const productDoc = await Product.findById(product);
        if (!productDoc) return sendError(res, "Product not found", 404);

        const lead = new Lead({
            customer,
            product,
            status: status || "New",
            estimatedValue: estimatedValue || 0,
            source,
            notes,
            logs: [
                {
                    status: status || "New",
                    label: `Lead initiated with status: ${status || "New"}`,
                    timestamp: new Date(),
                },
            ],
        });

        await lead.save();
        await lead.populate("customer product");

        return sendSuccess(res, lead, "Lead created successfully", 201);
    } catch (error) {
        return handleError(error, res);
    }
};

// Update lead
export const updateLead = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, estimatedValue, source, notes } = req.body;

        if (!isValidObjectId(id)) {
            return sendError(res, "Invalid lead ID", 400);
        }

        const lead = await Lead.findById(id);
        if (!lead) {
            return sendError(res, "Lead not found", 404);
        }

        if (status && lead.status !== status) {
            lead.status = status;
            lead.logs.push({
                status,
                label: `Status updated to: ${status}`,
                timestamp: new Date(),
            });
        }

        if (estimatedValue !== undefined) lead.estimatedValue = estimatedValue;
        if (source !== undefined) lead.source = source;
        if (notes !== undefined) lead.notes = notes;

        await lead.save();
        await lead.populate("customer product");

        return sendSuccess(res, lead, "Lead updated successfully");
    } catch (error) {
        return handleError(error, res);
    }
};

// Delete lead
export const deleteLead = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return sendError(res, "Invalid lead ID", 400);
        }

        const lead = await Lead.findByIdAndDelete(id);
        if (!lead) {
            return sendError(res, "Lead not found", 404);
        }

        return sendSuccess(res, null, "Lead deleted successfully");
    } catch (error) {
        return handleError(error, res);
    }
};

// Get lead statistics
export const getLeadStats = async (req: Request, res: Response) => {
    try {
        const total = await Lead.countDocuments();
        const won = await Lead.countDocuments({ status: "Closed Won" });
        const lost = await Lead.countDocuments({ status: "Closed Lost" });
        const active = total - (won + lost);

        const byStatus = await Lead.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                },
            },
        ]);

        const conversionRatio = total > 0 ? (won / total) * 100 : 0;

        const result = {
            total,
            won,
            lost,
            active,
            conversionRatio: conversionRatio.toFixed(2),
            byStatus: byStatus.reduce((acc: any, curr: any) => {
                acc[curr._id] = curr.count;
                return acc;
            }, {}),
        };

        return sendSuccess(res, result, "Lead statistics retrieved successfully");
    } catch (error) {
        return handleError(error, res);
    }
};
