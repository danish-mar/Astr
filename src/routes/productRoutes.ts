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
  importProducts
} from "../controllers/productController";

import multer from "multer";

import { authenticate, authorize, validateObjectId } from "../middleware";
import { productUpload } from "../utils/s3Service";


const router = Router();
const upload = multer({ dest: 'uploads/' });

// CSV Import/Export
router.get("/export", authenticate, authorize("Admin", "Manager", "CEO"), exportProducts);
router.get("/export-excel", authenticate, authorize("Admin", "Manager", "CEO"), exportProductsToExcel);

router.post("/import/preview", authenticate, authorize("Admin", "Manager", "CEO"), (req, res, next) => {
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
router.post("/import", authenticate, authorize("Admin", "Manager", "CEO"), (req, res, next) => {
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
router.get("/filters", authenticate, getFilters);
router.get("/", authenticate, getAllProducts);
router.get("/stats", authenticate, getProductStats);
router.get("/product-id/:productId", authenticate, getProductByProductID);
router.get("/:id", authenticate, validateObjectId("id"), getProductById);

// Protected routes (Admin, Manager, Sales, CEO)
router.post(
  "/",
  authenticate,
  authorize("Admin", "Manager", "Sales", "CEO"),
  productUpload.array('images', 5),
  createProduct
);
router.put(
  "/:id",
  authenticate,
  authorize("Admin", "Manager", "Sales", "CEO"),
  validateObjectId("id"),
  productUpload.array('images', 5),
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
