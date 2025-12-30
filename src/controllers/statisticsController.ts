import { Request, Response } from "express";
import Product from "../models/Product";
import ServiceTicket from "../models/ServiceTicket";
import Lead from "../models/Lead";
import { handleError, sendSuccess } from "../utils";

// ... previous getDashboardStats remains same ...

export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        // ... (existing code) ...
        const totalProducts = await Product.countDocuments();
        const availableProducts = await Product.countDocuments({ isSold: false });
        const soldProducts = await Product.countDocuments({ isSold: true });

        const totalTickets = await ServiceTicket.countDocuments();
        const pendingTickets = await ServiceTicket.countDocuments({ status: "Pending" });
        const completedTickets = await ServiceTicket.countDocuments({ status: "Completed" });

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const serviceRevenueResult = await ServiceTicket.aggregate([
            {
                $match: {
                    status: { $in: ["Completed", "Delivered"] },
                    updatedAt: { $gte: sevenDaysAgo },
                },
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$serviceCharge" },
                },
            },
        ]);
        const serviceRevenue = serviceRevenueResult.length > 0 ? serviceRevenueResult[0].total : 0;

        const productRevenueResult = await Product.aggregate([
            {
                $match: {
                    isSold: true,
                    updatedAt: { $gte: sevenDaysAgo },
                },
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$price" },
                },
            },
        ]);
        const productRevenue = productRevenueResult.length > 0 ? productRevenueResult[0].total : 0;

        const revenue = productRevenue + serviceRevenue;

        const recentProducts = await Product.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate("category", "name");

        const recentTickets = await ServiceTicket.find()
            .sort({ createdAt: -1 })
            .limit(5);

        const ticketStatusCounts = await ServiceTicket.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                },
            },
        ]);

        const revenueOverTime = await ServiceTicket.aggregate([
            {
                $match: {
                    status: { $in: ["Completed", "Delivered"] },
                    updatedAt: { $gte: sevenDaysAgo },
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    total: { $sum: "$serviceCharge" },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        const totalLeads = await Lead.countDocuments();
        const wonLeads = await Lead.countDocuments({ status: "Closed Won" });
        const leadConversionRatio = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

        return sendSuccess(res, {
            stats: {
                products: { total: totalProducts, available: availableProducts, sold: soldProducts },
                tickets: { total: totalTickets, pending: pendingTickets, completed: completedTickets },
                leads: { total: totalLeads, won: wonLeads, conversionRatio: leadConversionRatio.toFixed(2) },
                revenue,
                productRevenue,
                serviceRevenue,
            },
            recentProducts,
            recentTickets,
            charts: {
                ticketStatus: ticketStatusCounts,
                revenueTrend: revenueOverTime,
            },
        }, "Dashboard stats fetched successfully");
    } catch (error) {
        return handleError(error, res);
    }
};

export const getDetailedStats = async (req: Request, res: Response) => {
    try {
        const { range = '30d' } = req.query;

        const startDate = new Date();
        const previousStartDate = new Date();

        if (range === '7d') {
            startDate.setDate(startDate.getDate() - 7);
            previousStartDate.setDate(previousStartDate.getDate() - 14);
        } else if (range === '90d') {
            startDate.setDate(startDate.getDate() - 90);
            previousStartDate.setDate(previousStartDate.getDate() - 180);
        } else {
            startDate.setDate(startDate.getDate() - 30);
            previousStartDate.setDate(previousStartDate.getDate() - 60);
        }

        // 1. Revenue Calculation (Services + Products)
        const serviceRevenueResult = await ServiceTicket.aggregate([
            { $match: { status: { $in: ["Completed", "Delivered"] }, updatedAt: { $gte: startDate } } },
            { $group: { _id: null, total: { $sum: "$serviceCharge" } } }
        ]);
        const serviceRevenue = serviceRevenueResult[0]?.total || 0;

        const productRevenueResult = await Product.aggregate([
            { $match: { isSold: true, updatedAt: { $gte: startDate } } },
            { $group: { _id: null, total: { $sum: "$price" } } }
        ]);
        const productRevenue = productRevenueResult[0]?.total || 0;

        const totalRevenue = serviceRevenue + productRevenue;

        // 2. Expenditure Calculation Removed (Transitioned to Financial Gateway)
        const totalExpenditure = 0;

        // 3. Growth (Revenue)
        const prevServiceRevenueResult = await ServiceTicket.aggregate([
            { $match: { status: { $in: ["Completed", "Delivered"] }, updatedAt: { $gte: previousStartDate, $lt: startDate } } },
            { $group: { _id: null, total: { $sum: "$serviceCharge" } } }
        ]);
        const prevProductRevenueResult = await Product.aggregate([
            { $match: { isSold: true, updatedAt: { $gte: previousStartDate, $lt: startDate } } },
            { $group: { _id: null, total: { $sum: "$price" } } }
        ]);
        const prevRevenue = (prevServiceRevenueResult[0]?.total || 0) + (prevProductRevenueResult[0]?.total || 0);

        let revenueGrowth = 0;
        if (prevRevenue > 0) revenueGrowth = Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100);
        else if (totalRevenue > 0) revenueGrowth = 100;

        // 4. Counts
        const ticketsClosed = await ServiceTicket.countDocuments({ status: { $in: ["Completed", "Delivered"] }, updatedAt: { $gte: startDate } });
        const productsSold = await Product.countDocuments({ isSold: true, updatedAt: { $gte: startDate } });
        const avgTicketValue = ticketsClosed > 0 ? Math.round(serviceRevenue / ticketsClosed) : 0;

        // 5. Trends
        const revenueTrend = await ServiceTicket.aggregate([
            { $match: { status: { $in: ["Completed", "Delivered"] }, updatedAt: { $gte: startDate } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } }, total: { $sum: "$serviceCharge" } } },
            { $sort: { _id: 1 } }
        ]);

        const expenditureTrend: any[] = [];

        // 6. Distributions
        const categorySales = await Product.aggregate([
            { $match: { isSold: true, updatedAt: { $gte: startDate } } },
            { $lookup: { from: "categories", localField: "category", foreignField: "_id", as: "cat" } },
            { $unwind: "$cat" },
            { $group: { _id: "$cat.name", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            { $project: { name: "$_id", count: 1, _id: 0 } }
        ]);

        const expenditureByTag: any[] = [];

        // 7. Top Performance
        const topProducts = await Product.aggregate([
            { $match: { isSold: true, updatedAt: { $gte: startDate } } },
            { $lookup: { from: "categories", localField: "category", foreignField: "_id", as: "cat" } },
            { $unwind: { path: "$cat", preserveNullAndEmptyArrays: true } },
            { $group: { _id: "$name", category: { $first: "$cat.name" }, count: { $sum: 1 }, revenue: { $sum: "$price" } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        const topEmployees = await ServiceTicket.aggregate([
            { $match: { status: { $in: ["Completed", "Delivered"] }, updatedAt: { $gte: startDate }, assignedTechnician: { $exists: true, $ne: null } } },
            { $group: { _id: "$assignedTechnician", name: { $first: "$assignedTechnician" }, ticketsClosed: { $sum: 1 } } },
            { $sort: { ticketsClosed: -1 } },
            { $limit: 5 }
        ]);

        return sendSuccess(res, {
            stats: {
                totalRevenue,
                productRevenue,
                serviceRevenue,
                totalExpenditure,
                revenueGrowth,
                ticketsClosed,
                productsSold,
                avgTicketValue
            },
            charts: {
                revenueTrend,
                expenditureTrend,
                categorySales,
                expenditureByTag
            },
            topProducts,
            topEmployees
        }, "Detailed stats fetched successfully");
    } catch (error) {
        return handleError(error, res);
    }
};
