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
} from "../controllers/serviceTicketController";
import { authenticate, authorize, validateObjectId } from "../middleware";

const router = Router();

// Public/authenticated routes
router.get("/", authenticate, getAllServiceTickets);
router.get("/stats", authenticate, getServiceTicketStats);
router.get("/ticket/:ticketNumber", authenticate, getServiceTicketByNumber);
router.get(
  "/customer/:customerId",
  authenticate,
  validateObjectId("customerId"),
  getTicketsByCustomer
);
router.get("/:id", authenticate, validateObjectId("id"), getServiceTicketById);

// Protected routes (All staff can create/update tickets)
router.post("/", authenticate, createServiceTicket);
router.put("/:id", authenticate, validateObjectId("id"), updateServiceTicket);
router.patch(
  "/:id/status",
  authenticate,
  validateObjectId("id"),
  updateTicketStatus
);

// Delete (Admin, Manager, CEO only)
router.delete(
  "/:id",
  authenticate,
  authorize("Admin", "Manager", "CEO"),
  validateObjectId("id"),
  deleteServiceTicket
);

export default router;
