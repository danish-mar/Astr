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
  getFilters,
  exportProducts,
  exportProductsToExcel,
  previewImport,
  importProducts,
  getPublicProducts
} from "../controllers/productController";

import multer from "multer";

import { authenticate, authorize, validateObjectId, requirePermission } from "../middleware";
import { productUpload } from "../utils/s3Service";


const router = Router();
const upload = multer({ dest: 'uploads/' });

// CSV Import/Export
router.get("/export", authenticate, requirePermission("products:write"), exportProducts);
router.get("/export-excel", authenticate, requirePermission("products:write"), exportProductsToExcel);

router.post("/import/preview", authenticate, requirePermission("products:write"), (req, res, next) => {
  console.log('DEBUG: Route /import/preview hit');
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('DEBUG: Multer error:', err);
      return res.status(400).json({ message: "Upload error", error: err.message });
    }
    console.log('DEBUG: Multer success, moving to preview controller');
    next();
  });
}, previewImport);
router.post("/import", authenticate, requirePermission("products:write"), (req, res, next) => {
  console.log('DEBUG: Route /import hit');
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('DEBUG: Multer error:', err);
      return res.status(400).json({ message: "Upload error", error: err.message });
    }
    console.log('DEBUG: Multer success, moving to controller');
    next();
  });
}, importProducts);

// Public/authenticated routes
router.get("/filters", authenticate, requirePermission("products:read"), getFilters);
router.get("/", authenticate, requirePermission("products:read"), getAllProducts);
router.get("/stats", authenticate, requirePermission("products:read"), getProductStats);
router.get("/public", getPublicProducts);
router.get("/product-id/:productId", authenticate, requirePermission("products:read"), getProductByProductID);
router.get("/:id", authenticate, requirePermission("products:read"), validateObjectId("id"), getProductById);

// Protected routes (Admin, Manager, Sales, CEO)
router.post(
  "/",
  authenticate,
  requirePermission("products:write"),
  productUpload.array('images', 5),
  createProduct
);
router.put(
  "/:id",
  authenticate,
  requirePermission("products:write"),
  validateObjectId("id"),
  productUpload.array('images', 5),
  updateProduct
);
router.patch(
  "/:id/assign-id",
  authenticate,
  requirePermission("products:write"),
  validateObjectId("id"),
  assignProductIDToProduct
);
router.patch(
  "/:id/mark-sold",
  authenticate,
  requirePermission("products:write"),
  validateObjectId("id"),
  markProductAsSold
);

// Delete (Admin, CEO only or with products:write)
router.delete(
  "/:id",
  authenticate,
  requirePermission("products:write"),
  validateObjectId("id"),
  deleteProduct
);

export default router;
