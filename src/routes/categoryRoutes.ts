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
import { authenticate, authorize, validateObjectId } from "../middleware";

const router = Router();

// Public/authenticated routes
router.get("/", authenticate, getAllCategories);
router.get("/with-count", authenticate, getCategoriesWithCount);
router.get("/:id", authenticate, validateObjectId("id"), getCategoryById);
router.get(
  "/:id/template",
  authenticate,
  validateObjectId("id"),
  getCategoryTemplate
);

// Protected routes (Admin, Manager, CEO)
router.post(
  "/",
  authenticate,
  authorize("Admin", "Manager", "CEO"),
  createCategory
);
router.put(
  "/:id",
  authenticate,
  authorize("Admin", "Manager", "CEO"),
  validateObjectId("id"),
  updateCategory
);
router.delete(
  "/:id",
  authenticate,
  authorize("Admin", "CEO"),
  validateObjectId("id"),
  deleteCategory
);

export default router;
