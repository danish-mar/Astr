import { Request, Response } from "express";
import { Invoice, Contact, Product, Account, Transaction, ShopSettings } from "../models";
import { IInvoiceItem, IInvoicePayment } from "../models/Invoice";
import { handleError, sendSuccess, sendError, sendPaginated } from "../utils";
import mongoose from "mongoose";

/**
 * Helper to compute line item taxes and document totals based on GST rules
 */
export const calculateGstTotals = (
  items: Array<{
    itemType?: "product" | "service" | "custom";
    product?: string;
    description: string;
    hsnSac?: string;
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
    gstRate?: number;
  }>,
  shopState: string = "",
  customerState: string = ""
) => {
  const isInterState =
    shopState.trim() !== "" &&
    customerState.trim() !== "" &&
    shopState.trim().toLowerCase() !== customerState.trim().toLowerCase();

  let subtotal = 0;
  let totalDiscount = 0;
  let taxableTotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  const processedItems: IInvoiceItem[] = items.map((item) => {
    const qty = Math.max(0.01, Number(item.quantity) || 1);
    const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
    const discountPercent = Math.min(100, Math.max(0, Number(item.discountPercent) || 0));
    const gstRate = Math.max(0, Number(item.gstRate) || 0);

    const rawLineTotal = qty * unitPrice;
    const lineDiscount = Number(((rawLineTotal * discountPercent) / 100).toFixed(2));
    const taxableAmount = Number(Math.max(0, rawLineTotal - lineDiscount).toFixed(2));

    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (gstRate > 0) {
      if (isInterState) {
        igstAmount = Number(((taxableAmount * gstRate) / 100).toFixed(2));
      } else {
        const halfRate = gstRate / 2;
        cgstAmount = Number(((taxableAmount * halfRate) / 100).toFixed(2));
        sgstAmount = Number(((taxableAmount * halfRate) / 100).toFixed(2));
      }
    }

    const lineTotal = Number(
      (taxableAmount + cgstAmount + sgstAmount + igstAmount).toFixed(2)
    );

    subtotal += rawLineTotal;
    totalDiscount += lineDiscount;
    taxableTotal += taxableAmount;
    cgstTotal += cgstAmount;
    sgstTotal += sgstAmount;
    igstTotal += igstAmount;

    return {
      itemType: item.itemType || "custom",
      product: item.product ? new mongoose.Types.ObjectId(item.product) : undefined,
      description: item.description || "Item",
      hsnSac: item.hsnSac || "",
      quantity: qty,
      unitPrice,
      discountPercent,
      taxableAmount,
      gstRate,
      cgstAmount,
      sgstAmount,
      igstAmount,
      total: lineTotal,
    };
  });

  subtotal = Number(subtotal.toFixed(2));
  totalDiscount = Number(totalDiscount.toFixed(2));
  taxableTotal = Number(taxableTotal.toFixed(2));
  cgstTotal = Number(cgstTotal.toFixed(2));
  sgstTotal = Number(sgstTotal.toFixed(2));
  igstTotal = Number(igstTotal.toFixed(2));
  const taxTotal = Number((cgstTotal + sgstTotal + igstTotal).toFixed(2));

  const rawGrandTotal = taxableTotal + taxTotal;
  const grandTotal = Math.round(rawGrandTotal);
  const roundOff = Number((grandTotal - rawGrandTotal).toFixed(2));

  return {
    processedItems,
    subtotal,
    totalDiscount,
    taxableTotal,
    cgstTotal,
    sgstTotal,
    igstTotal,
    taxTotal,
    roundOff,
    grandTotal,
  };
};

/**
 * Get Next Document Number Preview
 */
export const getNextDocNumber = async (req: Request, res: Response) => {
  try {
    const docType = (req.query.type as string) || "Invoice";
    const settings = await ShopSettings.getSettings();

    let prefix = docType === "Quotation" ? (settings.quotationPrefix || "QTN-") : (settings.invoicePrefix || "INV-");
    let nextNum = docType === "Quotation" ? (settings.quotationNextNumber || 1001) : (settings.invoiceNextNumber || 1001);

    // Ensure number is unique
    let candidate = `${prefix}${nextNum}`;
    let exists = await Invoice.findOne({ docNumber: candidate });
    while (exists) {
      nextNum += 1;
      candidate = `${prefix}${nextNum}`;
      exists = await Invoice.findOne({ docNumber: candidate });
    }

    return sendSuccess(res, {
      prefix,
      nextNumber: nextNum,
      formattedNumber: candidate,
    });
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * List Invoices and Quotations with Filters and Stats
 */
export const getInvoices = async (req: Request, res: Response) => {
  try {
    const {
      docType,
      status,
      customer,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const filter: any = {};

    if (docType && (docType === "Invoice" || docType === "Quotation")) {
      filter.docType = docType;
    }

    if (status) {
      filter.status = status;
    }

    if (customer) {
      filter.customer = customer;
    }

    if (startDate || endDate) {
      filter.issueDate = {};
      if (startDate) filter.issueDate.$gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        filter.issueDate.$lte = end;
      }
    }

    if (search) {
      const searchRegex = new RegExp(search as string, "i");
      filter.$or = [
        { docNumber: searchRegex },
        { customerName: searchRegex },
        { customerPhone: searchRegex },
        { "items.description": searchRegex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit as string, 10) || 20);
    const skip = (pageNum - 1) * limitNum;

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .populate("customer", "name phone companyName")
        .sort({ issueDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Invoice.countDocuments(filter),
    ]);

    // Financial Metrics for Invoices
    const summaryAggregation = await Invoice.aggregate([
      { $match: { docType: "Invoice", status: { $ne: "Cancelled" } } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$grandTotal" },
          totalPaid: { $sum: "$paidAmount" },
          totalDue: { $sum: "$balanceDue" },
          totalTax: { $sum: "$taxTotal" },
          count: { $sum: 1 },
        },
      },
    ]);

    const quotationCount = await Invoice.countDocuments({
      docType: "Quotation",
      status: { $nin: ["Declined", "Cancelled"] },
    });

    const metrics = summaryAggregation[0] || {
      totalSales: 0,
      totalPaid: 0,
      totalDue: 0,
      totalTax: 0,
      count: 0,
    };

    return sendPaginated(
      res,
      invoices,
      pageNum,
      limitNum,
      total,
      "Documents fetched successfully"
    );
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * Get Invoice Summary Stats (for Quick KPI Tiles)
 */
export const getInvoiceMetrics = async (req: Request, res: Response) => {
  try {
    const summary = await Invoice.aggregate([
      { $match: { docType: "Invoice", status: { $ne: "Cancelled" } } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$grandTotal" },
          totalPaid: { $sum: "$paidAmount" },
          totalDue: { $sum: "$balanceDue" },
          totalTax: { $sum: "$taxTotal" },
          count: { $sum: 1 },
        },
      },
    ]);

    const quotations = await Invoice.countDocuments({
      docType: "Quotation",
    });

    const unpaidInvoices = await Invoice.countDocuments({
      docType: "Invoice",
      status: { $in: ["Unpaid", "Partially Paid", "Sent"] },
    });

    return sendSuccess(res, {
      sales: summary[0]?.totalSales || 0,
      collected: summary[0]?.totalPaid || 0,
      due: summary[0]?.totalDue || 0,
      tax: summary[0]?.totalTax || 0,
      totalInvoices: summary[0]?.count || 0,
      totalQuotations: quotations,
      unpaidCount: unpaidInvoices,
    });
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * Get Single Invoice/Quotation with Full Population
 */
export const getInvoiceById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findById(id)
      .populate("customer")
      .populate("serviceTicket", "ticketNumber deviceDetails status serviceCharge")
      .populate("items.product", "name productID price images isSold")
      .populate("payments.account", "accountName accountType")
      .populate("convertedFromQuotation", "docNumber")
      .populate("convertedToInvoice", "docNumber");

    if (!invoice) {
      return sendError(res, "Document not found", 404);
    }

    const settings = await ShopSettings.getSettings();

    return sendSuccess(res, {
      invoice,
      shop: {
        shopName: settings.shopName,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        logo: settings.logo,
        gstin: settings.gstin,
        state: settings.state,
        stateCode: settings.stateCode,
        bankName: settings.bankName,
        bankAccountNumber: settings.bankAccountNumber,
        bankIfsc: settings.bankIfsc,
        bankBranch: settings.bankBranch,
        upiId: settings.upiId,
        invoiceTerms: settings.invoiceTerms,
      },
    });
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * Create Invoice or Quotation
 */
export const createInvoice = async (req: Request, res: Response) => {
  try {
    const {
      docType = "Invoice",
      docNumber,
      customerId,
      customerName,
      customerPhone,
      customerAddress,
      customerGstin,
      customerState,
      serviceTicketId,
      items = [],
      status,
      issueDate,
      dueDate,
      notes,
      terms,
      initialPayment, // { amount, paymentMode, accountId, reference, notes }
    } = req.body;

    if (!customerId) {
      return sendError(res, "Customer is required", 400);
    }

    if (!items || items.length === 0) {
      return sendError(res, "At least one item is required", 400);
    }

    const contact = await Contact.findById(customerId);
    if (!contact) {
      return sendError(res, "Selected customer not found", 404);
    }

    // Save GST details to Contact if provided and not yet present
    if (customerGstin && !contact.gstin) {
      contact.gstin = customerGstin;
      await contact.save();
    }
    if (customerState && !contact.state) {
      contact.state = customerState;
      await contact.save();
    }

    const settings = await ShopSettings.getSettings();

    // Determine Document Number
    let finalDocNumber = docNumber ? docNumber.trim() : "";
    if (!finalDocNumber) {
      const isQuotation = docType === "Quotation";
      let prefix = isQuotation ? (settings.quotationPrefix || "QTN-") : (settings.invoicePrefix || "INV-");
      let nextNum = isQuotation ? (settings.quotationNextNumber || 1001) : (settings.invoiceNextNumber || 1001);

      let candidate = `${prefix}${nextNum}`;
      let exists = await Invoice.findOne({ docNumber: candidate });
      while (exists) {
        nextNum += 1;
        candidate = `${prefix}${nextNum}`;
        exists = await Invoice.findOne({ docNumber: candidate });
      }
      finalDocNumber = candidate;

      // Increment sequence in settings
      if (isQuotation) {
        settings.quotationNextNumber = nextNum + 1;
      } else {
        settings.invoiceNextNumber = nextNum + 1;
      }
      await settings.save();
    } else {
      const exists = await Invoice.findOne({ docNumber: finalDocNumber });
      if (exists) {
        return sendError(res, `Document number ${finalDocNumber} already exists`, 400);
      }
    }

    // Determine states for GST calculation
    const shopState = settings.state || "";
    const activeCustomerState = customerState || contact.state || "";

    const totals = calculateGstTotals(items, shopState, activeCustomerState);

    // Initial Payment calculation
    let paidAmount = 0;
    const paymentsList: IInvoicePayment[] = [];

    if (docType === "Invoice" && initialPayment && Number(initialPayment.amount) > 0) {
      const payAmt = Math.min(totals.grandTotal, Number(initialPayment.amount));
      paidAmount = payAmt;

      const paymentRecord: IInvoicePayment = {
        paymentDate: initialPayment.paymentDate ? new Date(initialPayment.paymentDate) : new Date(),
        amount: payAmt,
        paymentMode: initialPayment.paymentMode || "Cash",
        account: initialPayment.accountId ? new mongoose.Types.ObjectId(initialPayment.accountId) : undefined,
        reference: initialPayment.reference || finalDocNumber,
        notes: initialPayment.notes || "Initial payment on invoice creation",
      };

      // Ledger sync if account specified
      if (initialPayment.accountId) {
        const account = await Account.findById(initialPayment.accountId);
        if (account) {
          const tx = new Transaction({
            account: account._id,
            amount: payAmt,
            transactionType: "Credit",
            date: paymentRecord.paymentDate,
            description: `Payment for Invoice #${finalDocNumber}`,
            reference: finalDocNumber,
            serviceTicket: serviceTicketId || undefined,
          });
          await tx.save();

          account.totalBalance += payAmt;
          await account.save();

          paymentRecord.transaction = tx._id;
        }
      }

      paymentsList.push(paymentRecord);
    }

    const balanceDue = Number((totals.grandTotal - paidAmount).toFixed(2));

    // Default status logic
    let finalStatus = status;
    if (!finalStatus) {
      if (docType === "Quotation") {
        finalStatus = "Draft";
      } else {
        if (balanceDue <= 0) {
          finalStatus = "Paid";
        } else if (paidAmount > 0) {
          finalStatus = "Partially Paid";
        } else {
          finalStatus = "Unpaid";
        }
      }
    }

    const newInvoice = new Invoice({
      docType,
      docNumber: finalDocNumber,
      customer: contact._id,
      customerName: customerName || contact.name,
      customerPhone: customerPhone || contact.phone,
      customerAddress: customerAddress || contact.address,
      customerGstin: customerGstin || contact.gstin,
      customerState: activeCustomerState,
      serviceTicket: serviceTicketId || undefined,
      items: totals.processedItems,
      subtotal: totals.subtotal,
      totalDiscount: totals.totalDiscount,
      taxableTotal: totals.taxableTotal,
      cgstTotal: totals.cgstTotal,
      sgstTotal: totals.sgstTotal,
      igstTotal: totals.igstTotal,
      taxTotal: totals.taxTotal,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      paidAmount,
      balanceDue,
      status: finalStatus,
      issueDate: issueDate ? new Date(issueDate) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      payments: paymentsList,
      notes: notes || "",
      terms: terms || settings.invoiceTerms || "",
      bankDetails: {
        bankName: settings.bankName,
        bankAccountNumber: settings.bankAccountNumber,
        bankIfsc: settings.bankIfsc,
        bankBranch: settings.bankBranch,
        upiId: settings.upiId,
      },
    });

    await newInvoice.save();

    // Mark products as sold if attached to a confirmed invoice
    if (docType === "Invoice" && finalStatus !== "Draft") {
      for (const itm of totals.processedItems) {
        if (itm.product) {
          await Product.findByIdAndUpdate(itm.product, {
            isSold: true,
            soldDate: newInvoice.issueDate,
          });
        }
      }
    }

    return sendSuccess(res, newInvoice, `${docType} created successfully`, 201);
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * Update Invoice / Quotation
 */
export const updateInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return sendError(res, "Document not found", 404);
    }

    const {
      docNumber,
      customerId,
      customerName,
      customerPhone,
      customerAddress,
      customerGstin,
      customerState,
      serviceTicketId,
      items,
      status,
      issueDate,
      dueDate,
      notes,
      terms,
    } = req.body;

    const settings = await ShopSettings.getSettings();
    const activeCustomerState = customerState || invoice.customerState || "";

    if (items && Array.isArray(items) && items.length > 0) {
      const totals = calculateGstTotals(items, settings.state || "", activeCustomerState);
      invoice.items = totals.processedItems;
      invoice.subtotal = totals.subtotal;
      invoice.totalDiscount = totals.totalDiscount;
      invoice.taxableTotal = totals.taxableTotal;
      invoice.cgstTotal = totals.cgstTotal;
      invoice.sgstTotal = totals.sgstTotal;
      invoice.igstTotal = totals.igstTotal;
      invoice.taxTotal = totals.taxTotal;
      invoice.roundOff = totals.roundOff;
      invoice.grandTotal = totals.grandTotal;
      invoice.balanceDue = Number((totals.grandTotal - invoice.paidAmount).toFixed(2));
    }

    if (customerId) invoice.customer = new mongoose.Types.ObjectId(customerId);
    if (docNumber) invoice.docNumber = docNumber.trim();
    if (customerName) invoice.customerName = customerName;
    if (customerPhone !== undefined) invoice.customerPhone = customerPhone;
    if (customerAddress !== undefined) invoice.customerAddress = customerAddress;
    if (customerGstin !== undefined) invoice.customerGstin = customerGstin;
    if (customerState !== undefined) invoice.customerState = customerState;
    if (serviceTicketId !== undefined) invoice.serviceTicket = serviceTicketId || undefined;
    if (issueDate) invoice.issueDate = new Date(issueDate);
    if (dueDate !== undefined) invoice.dueDate = dueDate ? new Date(dueDate) : undefined;
    if (notes !== undefined) invoice.notes = notes;
    if (terms !== undefined) invoice.terms = terms;

    if (status) {
      invoice.status = status;
    } else if (invoice.docType === "Invoice") {
      if (invoice.balanceDue <= 0) invoice.status = "Paid";
      else if (invoice.paidAmount > 0) invoice.status = "Partially Paid";
    }

    await invoice.save();
    return sendSuccess(res, invoice, "Document updated successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * Record Payment against an Invoice (with Ledger sync)
 */
export const recordPayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, paymentDate, paymentMode = "Cash", accountId, reference, notes } = req.body;

    const payAmt = Number(amount);
    if (isNaN(payAmt) || payAmt <= 0) {
      return sendError(res, "Valid payment amount is required", 400);
    }

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return sendError(res, "Invoice not found", 404);
    }

    if (invoice.docType !== "Invoice") {
      return sendError(res, "Payments can only be applied to Invoices", 400);
    }

    if (invoice.balanceDue <= 0) {
      return sendError(res, "Invoice is already fully paid", 400);
    }

    const paymentRecord: IInvoicePayment = {
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      amount: payAmt,
      paymentMode,
      account: accountId ? new mongoose.Types.ObjectId(accountId) : undefined,
      reference: reference || `Payment #${invoice.docNumber}`,
      notes: notes || "",
    };

    // Accounting Sync
    if (accountId) {
      const account = await Account.findById(accountId);
      if (account) {
        const tx = new Transaction({
          account: account._id,
          amount: payAmt,
          transactionType: "Credit",
          date: paymentRecord.paymentDate,
          description: `Payment for Invoice #${invoice.docNumber}`,
          reference: invoice.docNumber,
          serviceTicket: invoice.serviceTicket || undefined,
        });
        await tx.save();

        account.totalBalance += payAmt;
        await account.save();

        paymentRecord.transaction = tx._id;
      }
    }

    invoice.payments.push(paymentRecord);
    invoice.paidAmount = Number((invoice.paidAmount + payAmt).toFixed(2));
    invoice.balanceDue = Number(Math.max(0, invoice.grandTotal - invoice.paidAmount).toFixed(2));

    if (invoice.balanceDue <= 0) {
      invoice.status = "Paid";
    } else {
      invoice.status = "Partially Paid";
    }

    await invoice.save();

    return sendSuccess(res, invoice, "Payment recorded successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * Convert Quotation to Invoice (One-click)
 */
export const convertQuotationToInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const quotation = await Invoice.findById(id);

    if (!quotation) {
      return sendError(res, "Quotation not found", 404);
    }

    if (quotation.docType !== "Quotation") {
      return sendError(res, "Document is not a quotation", 400);
    }

    if (quotation.status === "Converted") {
      return sendError(res, "This quotation has already been converted to an invoice", 400);
    }

    const settings = await ShopSettings.getSettings();
    const prefix = settings.invoicePrefix || "INV-";
    let nextNum = settings.invoiceNextNumber || 1001;

    let candidate = `${prefix}${nextNum}`;
    let exists = await Invoice.findOne({ docNumber: candidate });
    while (exists) {
      nextNum += 1;
      candidate = `${prefix}${nextNum}`;
      exists = await Invoice.findOne({ docNumber: candidate });
    }

    settings.invoiceNextNumber = nextNum + 1;
    await settings.save();

    const newInvoice = new Invoice({
      docType: "Invoice",
      docNumber: candidate,
      customer: quotation.customer,
      customerName: quotation.customerName,
      customerPhone: quotation.customerPhone,
      customerAddress: quotation.customerAddress,
      customerGstin: quotation.customerGstin,
      customerState: quotation.customerState,
      serviceTicket: quotation.serviceTicket,
      items: quotation.items,
      subtotal: quotation.subtotal,
      totalDiscount: quotation.totalDiscount,
      taxableTotal: quotation.taxableTotal,
      cgstTotal: quotation.cgstTotal,
      sgstTotal: quotation.sgstTotal,
      igstTotal: quotation.igstTotal,
      taxTotal: quotation.taxTotal,
      roundOff: quotation.roundOff,
      grandTotal: quotation.grandTotal,
      paidAmount: 0,
      balanceDue: quotation.grandTotal,
      status: "Unpaid",
      issueDate: new Date(),
      convertedFromQuotation: quotation._id,
      notes: quotation.notes,
      terms: quotation.terms || settings.invoiceTerms,
      bankDetails: {
        bankName: settings.bankName,
        bankAccountNumber: settings.bankAccountNumber,
        bankIfsc: settings.bankIfsc,
        bankBranch: settings.bankBranch,
        upiId: settings.upiId,
      },
    });

    await newInvoice.save();

    quotation.status = "Converted";
    quotation.convertedToInvoice = newInvoice._id;
    await quotation.save();

    return sendSuccess(
      res,
      { invoice: newInvoice, quotation },
      "Quotation converted to Invoice successfully"
    );
  } catch (error) {
    return handleError(error, res);
  }
};

/**
 * Delete or Void Invoice
 */
export const deleteInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findById(id);

    if (!invoice) {
      return sendError(res, "Document not found", 404);
    }

    if (invoice.payments && invoice.payments.length > 0) {
      return sendError(
        res,
        "Cannot delete an invoice that has recorded payments. Please void/cancel it instead.",
        400
      );
    }

    await Invoice.findByIdAndDelete(id);
    return sendSuccess(res, null, "Document deleted successfully");
  } catch (error) {
    return handleError(error, res);
  }
};
