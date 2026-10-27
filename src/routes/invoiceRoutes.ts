import { Router } from "express";
import {
  getInvoices,
  getInvoiceMetrics,
  getInvoiceById,
  getNextDocNumber,
  createInvoice,
  updateInvoice,
  recordPayment,
  convertQuotationToInvoice,
  deleteInvoice,
} from "../controllers/invoiceController";
import { authenticate, validateObjectId } from "../middleware";

const router = Router();

// Protect all routes with authentication
router.use(authenticate);

// Metrics and auto-numbering
router.get("/metrics", getInvoiceMetrics);
router.get("/next-number", getNextDocNumber);

// Core CRUD
router.get("/", getInvoices);
router.get("/:id", validateObjectId("id"), getInvoiceById);
router.post("/", createInvoice);
router.put("/:id", validateObjectId("id"), updateInvoice);
router.delete("/:id", validateObjectId("id"), deleteInvoice);

// Special Actions
router.post("/:id/payments", validateObjectId("id"), recordPayment);
router.post("/:id/convert", validateObjectId("id"), convertQuotationToInvoice);

export default router;
