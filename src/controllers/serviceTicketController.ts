import { Request, Response } from "express";
import ServiceTicket from "../models/ServiceTicket";
import Contact from "../models/Contact";
import { sendSuccess, sendError, sendPaginated, handleError } from "../utils";
import { validateRequiredFields, isValidObjectId } from "../utils";

// Get all service tickets with filtering and pagination
export const getAllServiceTickets = async (req: Request, res: Response) => {
  try {
    const {
      status,
      customer,
      technician,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    const filter: any = {};

    // Filter by status
    if (status && status !== "All") {
      filter.status = status;
    }

    // Filter by customer
    if (customer && isValidObjectId(customer as string)) {
      filter.customer = customer;
    }

    // Filter by technician
    if (technician) {
      filter.assignedTechnician = { $regex: technician, $options: "i" };
    }

    // Search by ticket number or device details
    if (search) {
      const searchStr = (search as string).replace("#", "");
      filter.$or = [
        { ticketNumber: { $regex: searchStr, $options: "i" } },
        { deviceDetails: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const tickets = await ServiceTicket.find(filter)
      .populate("customer", "name phone companyName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await ServiceTicket.countDocuments(filter);

    return sendPaginated(
      res,
      tickets,
      pageNum,
      limitNum,
      total,
      "Service tickets retrieved successfully"
    );
  } catch (error) {
    return handleError(error, res);
  }
};

// Get single service ticket by ID
export const getServiceTicketById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid service ticket ID", 400);
    }

    const ticket = await ServiceTicket.findById(id).populate("customer");

    if (!ticket) {
      return sendError(res, "Service ticket not found", 404);
    }

    return sendSuccess(res, ticket, "Service ticket retrieved successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Get service ticket by ticket number
export const getServiceTicketByNumber = async (req: Request, res: Response) => {
  try {
    const { ticketNumber } = req.params;

    const ticket = await ServiceTicket.findOne({ ticketNumber }).populate(
      "customer"
    );

    if (!ticket) {
      return sendError(res, "Service ticket not found", 404);
    }

    return sendSuccess(res, ticket, "Service ticket retrieved successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Create new service ticket
export const createServiceTicket = async (req: Request, res: Response) => {
  try {
    const {
      customer,
      deviceDetails,
      status,
      assignedTechnician,
      serviceCharge,
      notes,
    } = req.body;

    // Validate required fields
    const missing = validateRequiredFields(req.body, [
      "customer",
      "deviceDetails",
    ]);
    if (missing.length > 0) {
      return sendError(
        res,
        `Missing required fields: ${missing.join(", ")}`,
        400
      );
    }

    // Validate customer ID
    if (!isValidObjectId(customer)) {
      return sendError(res, "Invalid customer ID", 400);
    }

    // Verify customer exists and is of type 'Customer'
    const customerDoc = await Contact.findById(customer);

    if (!customerDoc) {
      return sendError(res, "Customer not found", 404);
    }

    if (customerDoc.contactType !== "Customer") {
      return sendError(res, 'Selected contact must be of type "Customer"', 400);
    }

    // Create service ticket (ticketNumber is auto-generated)
    const ticket = new ServiceTicket({
      customer,
      deviceDetails,
      status: status || "Pending", // Use provided status or default to Pending
      assignedTechnician,
      serviceCharge: serviceCharge || 0,
      notes,
      logs: [
        {
          status: status || "Pending",
          label: `Ticket initiated with status: ${status || "Pending"}`,
          timestamp: new Date(),
        },
      ],
    });

    await ticket.save();

    // Populate before sending response
    await ticket.populate("customer");

    return sendSuccess(res, ticket, "Service ticket created successfully", 201);
  } catch (error) {
    return handleError(error, res);
  }
};

// Update service ticket
export const updateServiceTicket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      deviceDetails,
      status,
      assignedTechnician,
      serviceCharge,
      notes,
      logEntry,
    } = req.body;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid service ticket ID", 400);
    }

    const ticket = await ServiceTicket.findById(id);

    if (!ticket) {
      return sendError(res, "Service ticket not found", 404);
    }

    // Update fields
    if (deviceDetails) ticket.deviceDetails = deviceDetails;
    if (status && ticket.status !== status) {
      ticket.status = status;
      ticket.logs.push({
        status,
        label: `Status updated to: ${status}`,
        timestamp: new Date(),
      });
    }
    if (assignedTechnician !== undefined)
      ticket.assignedTechnician = assignedTechnician;
    if (serviceCharge !== undefined) ticket.serviceCharge = serviceCharge;
    if (notes !== undefined) ticket.notes = notes;

    await ticket.save();
    await ticket.populate("customer");

    return sendSuccess(res, ticket, "Service ticket updated successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Update ticket status
export const updateTicketStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid service ticket ID", 400);
    }

    if (!status) {
      return sendError(res, "Status is required", 400);
    }

    const validStatuses = [
      "Pending",
      "In Progress",
      "Completed",
      "Delivered",
      "Cancelled",
      "Reopened",
    ];
    if (!validStatuses.includes(status)) {
      return sendError(res, "Invalid status", 400);
    }

    const ticket = await ServiceTicket.findById(id);

    if (!ticket) {
      return sendError(res, "Service ticket not found", 404);
    }

    if (ticket.status !== status) {
      ticket.status = status;
      ticket.logs.push({
        status,
        label: `Status transitioned to: ${status}`,
        timestamp: new Date(),
      });
    }
    await ticket.save();
    await ticket.populate("customer");

    return sendSuccess(res, ticket, "Ticket status updated successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Delete service ticket
export const deleteServiceTicket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid service ticket ID", 400);
    }

    const ticket = await ServiceTicket.findByIdAndDelete(id);

    if (!ticket) {
      return sendError(res, "Service ticket not found", 404);
    }

    return sendSuccess(res, null, "Service ticket deleted successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Get service ticket statistics
export const getServiceTicketStats = async (req: Request, res: Response) => {
  try {
    const total = await ServiceTicket.countDocuments();

    const byStatus = await ServiceTicket.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const totalRevenue = await ServiceTicket.aggregate([
      {
        $match: { status: { $in: ["Completed", "Delivered"] } },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$serviceCharge" },
        },
      },
    ]);

    const result = {
      total,
      byStatus: byStatus.reduce((acc: any, curr: any) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
      totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
    };

    return sendSuccess(
      res,
      result,
      "Service ticket statistics retrieved successfully"
    );
  } catch (error) {
    return handleError(error, res);
  }
};

// Get tickets by customer
export const getTicketsByCustomer = async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    if (!isValidObjectId(customerId)) {
      return sendError(res, "Invalid customer ID", 400);
    }

    const tickets = await ServiceTicket.find({ customer: customerId })
      .populate("customer")
      .sort({ createdAt: -1 });

    return sendSuccess(res, tickets, "Customer tickets retrieved successfully");
  } catch (error) {
    return handleError(error, res);
  }
};
