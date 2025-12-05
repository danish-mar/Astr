import { Router } from "express";
import {
  getAllProducts,
  getProductById,
  getProductByProductID,
  createProduct,
  updateProduct,
  deleteProduct,
  assignProductIDToProduct,
  markProductAsSold,
  getProductStats,
} from "../controllers/productController";
import { authenticate, authorize, validateObjectId } from "../middleware";

const router = Router();

// Public/authenticated routes
router.get("/", authenticate, getAllProducts);
router.get("/stats", authenticate, getProductStats);
router.get("/product-id/:productId", authenticate, getProductByProductID);
router.get("/:id", authenticate, validateObjectId("id"), getProductById);

// Protected routes (Admin, Manager, Sales, CEO)
router.post(
  "/",
  authenticate,
  authorize("Admin", "Manager", "Sales", "CEO"),
  createProduct
);
router.put(
  "/:id",
  authenticate,
  authorize("Admin", "Manager", "Sales", "CEO"),
  validateObjectId("id"),
  updateProduct
);
router.patch(
  "/:id/assign-id",
  authenticate,
  authorize("Admin", "Manager", "CEO"),
  validateObjectId("id"),
  assignProductIDToProduct
);
router.patch(
  "/:id/mark-sold",
  authenticate,
  authorize("Admin", "Manager", "Sales", "CEO"),
  validateObjectId("id"),
  markProductAsSold
);

// Delete (Admin, CEO only)
router.delete(
  "/:id",
  authenticate,
  authorize("Admin", "CEO"),
  validateObjectId("id"),
  deleteProduct
);

export default router;
