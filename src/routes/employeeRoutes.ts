import { Router } from "express";
import {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  updateEmployeePassword,
  deleteEmployee,
  permanentlyDeleteEmployee,
  loginEmployee,
  getCurrentEmployee,
  getEmployeeStats,
} from "../controllers/employeeController";
import {
  authenticate,
  authorize,
  validateObjectId,
  validateFields,
} from "../middleware";

const router = Router();

// Public routes
router.post("/login", validateFields(["username", "password"]), loginEmployee);

// Authenticated routes
router.get("/me", authenticate, getCurrentEmployee);
router.put(
  "/me/password",
  authenticate,
  validateFields(["currentPassword", "newPassword"]),
  updateEmployeePassword
);

// Admin/Manager/CEO routes
router.get(
  "/",
  authenticate,
  authorize("Admin", "Manager", "CEO"),
  getAllEmployees
);
router.get(
  "/stats",
  authenticate,
  authorize("Admin", "Manager", "CEO"),
  getEmployeeStats
);
router.get(
  "/:id",
  authenticate,
  authorize("Admin", "Manager", "CEO"),
  validateObjectId("id"),
  getEmployeeById
);
router.post("/", authenticate, authorize("Admin", "CEO"), createEmployee);
router.put(
  "/:id",
  authenticate,
  authorize("Admin", "CEO"),
  validateObjectId("id"),
  updateEmployee
);
router.delete(
  "/:id",
  authenticate,
  authorize("Admin", "CEO"),
  validateObjectId("id"),
  deleteEmployee
);
router.delete(
  "/:id/permanent",
  authenticate,
  authorize("Admin", "CEO"),
  validateObjectId("id"),
  permanentlyDeleteEmployee
);

export default router;
