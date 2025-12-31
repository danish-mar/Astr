import { Router } from "express";
import {
  getAllContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
  getContactsByType,
  getContactStats,
} from "../controllers/contactController";
import { authenticate, authorize, validateObjectId, requirePermission } from "../middleware";

const router = Router();

// Public/authenticated routes
router.get("/", authenticate, requirePermission("contacts:read"), getAllContacts);
router.get("/stats", authenticate, requirePermission("contacts:read"), getContactStats);
router.get("/type/:type", authenticate, requirePermission("contacts:read"), getContactsByType);
router.get("/:id", authenticate, requirePermission("contacts:read"), validateObjectId("id"), getContactById);

// Protected routes (require contacts:write)
router.post(
  "/",
  authenticate,
  requirePermission("contacts:write"),
  createContact
);
router.put(
  "/:id",
  authenticate,
  requirePermission("contacts:write"),
  validateObjectId("id"),
  updateContact
);
router.delete(
  "/:id",
  authenticate,
  requirePermission("contacts:write"),
  validateObjectId("id"),
  deleteContact
);

export default router;
