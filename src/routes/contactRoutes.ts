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
import { authenticate, authorize, validateObjectId } from "../middleware";

const router = Router();

// Public/authenticated routes
router.get("/", authenticate, getAllContacts);
router.get("/stats", authenticate, getContactStats);
router.get("/type/:type", authenticate, getContactsByType);
router.get("/:id", authenticate, validateObjectId("id"), getContactById);

// Protected routes (Admin, Manager, CEO)
router.post(
  "/",
  authenticate,
  authorize("Admin", "Manager", "CEO"),
  createContact
);
router.put(
  "/:id",
  authenticate,
  authorize("Admin", "Manager", "CEO"),
  validateObjectId("id"),
  updateContact
);
router.delete(
  "/:id",
  authenticate,
  authorize("Admin", "CEO"),
  validateObjectId("id"),
  deleteContact
);

export default router;
