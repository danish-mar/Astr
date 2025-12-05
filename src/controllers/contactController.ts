import { Request, Response } from "express";
import Contact from "../models/Contact";
import { sendSuccess, sendError, sendPaginated, handleError } from "../utils";
import { validateRequiredFields, isValidObjectId } from "../utils";

// Get all contacts with optional filtering and pagination
export const getAllContacts = async (req: Request, res: Response) => {
  try {
    const { contactType, search, page = 1, limit = 10 } = req.query;

    const filter: any = {};

    // Filter by contact type
    if (contactType && contactType !== "All") {
      filter.contactType = contactType;
    }

    // Search by name, phone, or company
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { companyName: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const contacts = await Contact.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Contact.countDocuments(filter);

    return sendPaginated(
      res,
      contacts,
      pageNum,
      limitNum,
      total,
      "Contacts retrieved successfully"
    );
  } catch (error) {
    return handleError(error, res);
  }
};

// Get single contact by ID
export const getContactById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid contact ID", 400);
    }

    const contact = await Contact.findById(id);

    if (!contact) {
      return sendError(res, "Contact not found", 404);
    }

    return sendSuccess(res, contact, "Contact retrieved successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Create new contact
export const createContact = async (req: Request, res: Response) => {
  try {
    const { name, phone, contactType, address, companyName, notes } = req.body;

    // Validate required fields
    const missing = validateRequiredFields(req.body, [
      "name",
      "phone",
      "contactType",
    ]);
    if (missing.length > 0) {
      return sendError(
        res,
        `Missing required fields: ${missing.join(", ")}`,
        400
      );
    }

    // Create contact
    const contact = new Contact({
      name,
      phone,
      contactType,
      address,
      companyName,
      notes,
    });

    await contact.save();

    return sendSuccess(res, contact, "Contact created successfully", 201);
  } catch (error) {
    return handleError(error, res);
  }
};

// Update contact
export const updateContact = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, phone, contactType, address, companyName, notes } = req.body;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid contact ID", 400);
    }

    const contact = await Contact.findById(id);

    if (!contact) {
      return sendError(res, "Contact not found", 404);
    }

    // Update fields
    if (name) contact.name = name;
    if (phone) contact.phone = phone;
    if (contactType) contact.contactType = contactType;
    if (address !== undefined) contact.address = address;
    if (companyName !== undefined) contact.companyName = companyName;
    if (notes !== undefined) contact.notes = notes;

    await contact.save();

    return sendSuccess(res, contact, "Contact updated successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Delete contact
export const deleteContact = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid contact ID", 400);
    }

    const contact = await Contact.findByIdAndDelete(id);

    if (!contact) {
      return sendError(res, "Contact not found", 404);
    }

    return sendSuccess(res, null, "Contact deleted successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Get contacts by type
export const getContactsByType = async (req: Request, res: Response) => {
  try {
    const { type } = req.params;

    const validTypes = ["Vendor", "Customer", "Supplier", "Custom"];
    if (!validTypes.includes(type)) {
      return sendError(res, "Invalid contact type", 400);
    }

    const contacts = await Contact.find({ contactType: type }).sort({
      name: 1,
    });

    return sendSuccess(
      res,
      contacts,
      `${type} contacts retrieved successfully`
    );
  } catch (error) {
    return handleError(error, res);
  }
};

// Get contact statistics
export const getContactStats = async (req: Request, res: Response) => {
  try {
    const stats = await Contact.aggregate([
      {
        $group: {
          _id: "$contactType",
          count: { $sum: 1 },
        },
      },
    ]);

    const total = await Contact.countDocuments();

    const result = {
      total,
      byType: stats.reduce((acc: any, curr: any) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
    };

    return sendSuccess(
      res,
      result,
      "Contact statistics retrieved successfully"
    );
  } catch (error) {
    return handleError(error, res);
  }
};
