import { Request, Response } from "express";
import Product from "../models/Product";
import ServiceTicket from "../models/ServiceTicket";
import Lead from "../models/Lead";
import { handleError, sendSuccess } from "../utils";


export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        // 1. Product Stats
        const totalProducts = await Product.countDocuments();
        const availableProducts = await Product.countDocuments({ isSold: false });
        const soldProducts = await Product.countDocuments({ isSold: true });

        // 2. Ticket Stats
        const totalTickets = await ServiceTicket.countDocuments();
        const pendingTickets = await ServiceTicket.countDocuments({
            status: "Pending",
        });
        const completedTickets = await ServiceTicket.countDocuments({
            status: "Completed",
        });

        // 3. Revenue (Last 7 Days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Service Ticket Revenue (Sum of service charges for completed/delivered tickets)
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

        // Product Sales Revenue (Last 7 Days)
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

        // Total Revenue
        const revenue = productRevenue + serviceRevenue;

        // 4. Recent Activity
        const recentProducts = await Product.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate("category", "name");

        const recentTickets = await ServiceTicket.find()
            .sort({ createdAt: -1 })
            .limit(5);

        // 5. Chart Data: Tickets by Status
        const ticketStatusCounts = await ServiceTicket.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                },
            },
        ]);

        // 6. Chart Data: Revenue Last 7 Days
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

        // 7. Lead Stats
        const totalLeads = await Lead.countDocuments();
        const wonLeads = await Lead.countDocuments({ status: "Closed Won" });
        const leadConversionRatio = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

        return sendSuccess(res, {
            stats: {
                products: {
                    total: totalProducts,
                    available: availableProducts,
                    sold: soldProducts,
                },
                tickets: {
                    total: totalTickets,
                    pending: pendingTickets,
                    completed: completedTickets,
                },
                leads: {
                    total: totalLeads,
                    won: wonLeads,
                    conversionRatio: leadConversionRatio.toFixed(2),
                },
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
        console.log("Fetching detailed stats...");
        const { range = '30d' } = req.query;

        // Calculate start date based on range
        const startDate = new Date();
        const previousStartDate = new Date(); // For growth calculation

        if (range === '7d') {
            startDate.setDate(startDate.getDate() - 7);
            previousStartDate.setDate(previousStartDate.getDate() - 14);
        } else if (range === '90d') {
            startDate.setDate(startDate.getDate() - 90);
            previousStartDate.setDate(previousStartDate.getDate() - 180);
        } else {
            // Default 30d
            startDate.setDate(startDate.getDate() - 30);
            previousStartDate.setDate(previousStartDate.getDate() - 60);
        }

        // 1. Key Metrics
        console.log("Calculating revenue...");
        // Revenue
        const revenueResult = await ServiceTicket.aggregate([
            {
                $match: {
                    status: { $in: ["Completed", "Delivered"] },
                    updatedAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$serviceCharge" }
                }
            }
        ]);
        const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

        // Previous Revenue for Growth
        const prevRevenueResult = await ServiceTicket.aggregate([
            {
                $match: {
                    status: { $in: ["Completed", "Delivered"] },
                    updatedAt: { $gte: previousStartDate, $lt: startDate }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$serviceCharge" }
                }
            }
        ]);
        const prevRevenue = prevRevenueResult.length > 0 ? prevRevenueResult[0].total : 0;

        let revenueGrowth = 0;
        if (prevRevenue > 0) {
            revenueGrowth = Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100);
        } else if (totalRevenue > 0) {
            revenueGrowth = 100;
        }

        // Product Sales Revenue
        console.log("Calculating product revenue...");
        const productRevenueResult = await Product.aggregate([
            {
                $match: {
                    isSold: true,
                    updatedAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$price" }
                }
            }
        ]);
        const productRevenue = productRevenueResult.length > 0 ? productRevenueResult[0].total : 0;

        // Service Ticket Revenue (already calculated as totalRevenue)
        const serviceRevenue = totalRevenue;

        // Combined Total Revenue
        const combinedTotalRevenue = productRevenue + serviceRevenue;

        // Tickets Closed
        const ticketsClosed = await ServiceTicket.countDocuments({
            status: { $in: ["Completed", "Delivered"] },
            updatedAt: { $gte: startDate }
        });

        // Products Sold
        const productsSold = await Product.countDocuments({
            isSold: true,
            updatedAt: { $gte: startDate }
        });

        // Avg Ticket Value
        const avgTicketValue = ticketsClosed > 0 ? Math.round(totalRevenue / ticketsClosed) : 0;

        // 2. Revenue Trend (Daily)
        console.log("Calculating revenue trend...");
        const revenueTrend = await ServiceTicket.aggregate([
            {
                $match: {
                    status: { $in: ["Completed", "Delivered"] },
                    updatedAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    total: { $sum: "$serviceCharge" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // 3. Category Sales (Top 5)
        console.log("Calculating category sales...");
        // Note: This requires Product model to have category reference populated or aggregated
        // Assuming Product has 'category' field which is ObjectId
        const categorySales = await Product.aggregate([
            {
                $match: {
                    isSold: true,
                    updatedAt: { $gte: startDate }
                }
            },
            {
                $lookup: {
                    from: "categories",
                    localField: "category",
                    foreignField: "_id",
                    as: "categoryInfo"
                }
            },
            { $unwind: "$categoryInfo" },
            {
                $group: {
                    _id: "$categoryInfo.name",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 5 },
            {
                $project: {
                    name: "$_id",
                    count: 1,
                    _id: 0
                }
            }
        ]);

        // 4. Top Selling Products
        console.log("Calculating top products...");
        // Since products are unique items, we might group by name (if multiple items have same name)
        // or just list recent sold items. Let's group by name.
        const topProducts = await Product.aggregate([
            {
                $match: {
                    isSold: true,
                    updatedAt: { $gte: startDate }
                }
            },
            {
                $lookup: {
                    from: "categories",
                    localField: "category",
                    foreignField: "_id",
                    as: "categoryInfo"
                }
            },
            { $unwind: { path: "$categoryInfo", preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: "$name",
                    category: { $first: "$categoryInfo.name" },
                    count: { $sum: 1 },
                    revenue: { $sum: "$price" } // Assuming price is the revenue per product
                }
            },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        // 5. Top Employees (Technicians)
        console.log("Calculating top employees...");
        const topEmployees = await ServiceTicket.aggregate([
            {
                $match: {
                    status: { $in: ["Completed", "Delivered"] },
                    updatedAt: { $gte: startDate },
                    assignedTechnician: { $exists: true, $nin: [null, ""] }
                }
            },
            {
                $group: {
                    _id: "$assignedTechnician",
                    name: { $first: "$assignedTechnician" },
                    ticketsClosed: { $sum: 1 }
                }
            },
            { $sort: { ticketsClosed: -1 } },
            { $limit: 5 }
        ]);

        console.log("Detailed stats fetched successfully");

        return sendSuccess(res, {
            stats: {
                totalRevenue: combinedTotalRevenue,
                productRevenue,
                serviceRevenue,
                revenueGrowth,
                ticketsClosed,
                productsSold,
                avgTicketValue
            },
            charts: {
                revenueTrend,
                categorySales
            },
            topProducts,
            topEmployees
        }, "Detailed stats fetched successfully");
    } catch (error) {
        console.error("Error in getDetailedStats:", error);
        return handleError(error, res);
    }
};
