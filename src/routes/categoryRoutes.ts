import { Router } from "express";
import {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoriesWithCount,
  getCategoryTemplate,
} from "../controllers/categoryController";
import { authenticate, authorize, validateObjectId, requirePermission } from "../middleware";

const router = Router();

// Public/authenticated routes
router.get("/", authenticate, requirePermission("products:read"), getAllCategories);
router.get("/with-count", authenticate, requirePermission("products:read"), getCategoriesWithCount);
router.get("/:id", authenticate, requirePermission("products:read"), validateObjectId("id"), getCategoryById);
router.get(
  "/:id/template",
  authenticate,
  requirePermission("products:read"),
  validateObjectId("id"),
  getCategoryTemplate
);

// Protected routes (Admin, Manager, CEO)
router.post(
  "/",
  authenticate,
  requirePermission("products:write"),
  createCategory
);
router.put(
  "/:id",
  authenticate,
  requirePermission("products:write"),
  validateObjectId("id"),
  updateCategory
);
router.delete(
  "/:id",
  authenticate,
  requirePermission("products:write"),
  validateObjectId("id"),
  deleteCategory
);

export default router;
