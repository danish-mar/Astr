import { Router } from "express";
import {
  getAllServiceTickets,
  getServiceTicketById,
  getServiceTicketByNumber,
  createServiceTicket,
  updateServiceTicket,
  updateTicketStatus,
  deleteServiceTicket,
  getServiceTicketStats,
  getTicketsByCustomer,
  settleTicketPayment,
} from "../controllers/serviceTicketController";
import { authenticate, authorize, validateObjectId, requirePermission } from "../middleware";

const router = Router();

// Public/authenticated routes
router.get("/", authenticate, requirePermission("tickets:read"), getAllServiceTickets);
router.get("/stats", authenticate, requirePermission("tickets:read"), getServiceTicketStats);
router.get("/ticket/:ticketNumber", authenticate, requirePermission("tickets:read"), getServiceTicketByNumber);
router.get(
  "/customer/:customerId",
  authenticate,
  requirePermission("tickets:read"),
  validateObjectId("customerId"),
  getTicketsByCustomer
);
router.get("/:id", authenticate, requirePermission("tickets:read"), validateObjectId("id"), getServiceTicketById);

// Protected routes (require tickets:write)
router.post("/", authenticate, requirePermission("tickets:write"), createServiceTicket);
router.put("/:id", authenticate, requirePermission("tickets:write"), validateObjectId("id"), updateServiceTicket);
router.patch(
  "/:id/status",
  authenticate,
  requirePermission("tickets:write"),
  validateObjectId("id"),
  updateTicketStatus
);
router.post(
  "/:id/settle-payment",
  authenticate,
  requirePermission("tickets:write"),
  validateObjectId("id"),
  settleTicketPayment
);

// Delete (Admin, CEO only or with tickets:write)
router.delete(
  "/:id",
  authenticate,
  requirePermission("tickets:write"),
  validateObjectId("id"),
  deleteServiceTicket
);

export default router;
