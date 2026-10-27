import { Request, Response } from "express";
import ServiceTicket from "../models/ServiceTicket";
import Contact from "../models/Contact";
import { Product, Lead, Invoice } from "../models";
import { sendSuccess, handleError } from "../utils";

/**
 * Global search across ServiceTickets, Contacts, Products, Leads, and Invoices
 */
export const globalSearch = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== "string") {
      return sendSuccess(res, { tickets: [], contacts: [], products: [], leads: [], invoices: [] }, "Empty search query");
    }

    const searchStr = q.trim();
    const searchRegex = { $regex: searchStr, $options: "i" };

    // Execute concurrent searches
    const [tickets, contacts, products, leads, invoices] = await Promise.all([
      // Search Tickets by number or device
      ServiceTicket.find({
        $or: [
          { ticketNumber: { $regex: searchStr.replace("#", ""), $options: "i" } },
          { deviceDetails: searchRegex },
        ],
      })
        .populate("customer", "name")
        .limit(5)
        .sort({ createdAt: -1 }),

      // Search Contacts by name, phone, or company
      Contact.find({
        $or: [
          { name: searchRegex },
          { phone: searchRegex },
          { companyName: searchRegex },
        ],
      })
        .limit(5)
        .sort({ name: 1 }),

      // Search Products by name or Product ID
      Product.find({
        $or: [
          { name: searchRegex },
          { productID: searchRegex },
        ],
      })
        .limit(5)
        .sort({ createdAt: -1 }),

      // Search Leads by ID, notes, or populated customer/product name
      Lead.find({
        $or: [
          { leadID: searchRegex },
          { notes: searchRegex },
          { source: searchRegex },
        ],
      })
        .populate("customer", "name")
        .populate("product", "name")
        .limit(5)
        .sort({ createdAt: -1 }),

      // Search Invoices & Quotations
      Invoice.find({
        $or: [
          { docNumber: searchRegex },
          { customerName: searchRegex },
          { customerPhone: searchRegex },
        ],
      })
        .limit(5)
        .sort({ issueDate: -1 }),
    ]);

    const results = {
      invoices: invoices.map(i => ({
        id: i._id,
        title: `${i.docType}: ${i.docNumber}`,
        subtitle: `${i.customerName} • ₹${i.grandTotal.toLocaleString('en-IN')}`,
        url: `/invoices/${i._id}`,
        status: i.status,
      })),
      tickets: tickets.map(t => ({
        id: t._id,
        title: (t as any).customer?.name || "Unknown Customer",
        subtitle: `TAG #${t.ticketNumber} - ${t.deviceDetails}`,
        url: `/service-tickets/${t._id}`,
        status: t.status,
      })),
      contacts: contacts.map(c => ({
        id: c._id,
        title: c.name,
        subtitle: c.companyName ? `${c.companyName} (${c.phone})` : c.phone,
        url: `/contacts?id=${c._id}`,
        type: c.contactType,
      })),
      products: products.map(p => ({
        id: p._id,
        title: p.name,
        subtitle: p.productID ? `ID: ${p.productID}` : "No ID",
        url: `/products?id=${p._id}`,
        isSold: p.isSold,
      })),
      leads: leads.map(l => ({
        id: l._id,
        title: (l as any).customer?.name || "Unknown Customer",
        subtitle: `LEAD #${l.leadID} - ${(l as any).product?.name || "Unknown Product"}`,
        url: `/leads?id=${l._id}`,
        status: l.status,
      })),
    };

    return sendSuccess(res, results, "Global search results retrieved successfully");
  } catch (error) {
    return handleError(error, res);
  }
};
