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
  adminResetPassword,
  updatePermissions,
  getDetailedProfile,
  syncEmployeeLedger,
  updateEmployeeStatus,
  updateEmployeeGroup,
} from "../controllers/employeeController";
import {
  authenticate,
  authorize,
  validateObjectId,
  validateFields,
  requirePermission,
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

// Admin/Manager/CEO routes (Required settings:manage to view team list)
router.get(
  "/",
  authenticate,
  requirePermission("settings:manage"),
  getAllEmployees
);
router.get(
  "/stats",
  authenticate,
  requirePermission("settings:manage"),
  getEmployeeStats
);
router.get(
  "/:id",
  authenticate,
  requirePermission("settings:manage"),
  validateObjectId("id"),
  getEmployeeById
);

// Admin-only detailed actions (require settings:manage)
router.get(
  "/:id/detailed",
  authenticate,
  requirePermission("settings:manage"),
  validateObjectId("id"),
  getDetailedProfile
);
router.put(
  "/:id/reset-password",
  authenticate,
  requirePermission("settings:manage"),
  validateObjectId("id"),
  validateFields(["newPassword"]),
  adminResetPassword
);
router.put(
  "/:id/permissions",
  authenticate,
  requirePermission("settings:manage"),
  validateObjectId("id"),
  validateFields(["permissions"]),
  updatePermissions
);

router.put(
  "/:id/status",
  authenticate,
  requirePermission("settings:manage"),
  validateObjectId("id"),
  updateEmployeeStatus
);

router.put(
  "/:id/group",
  authenticate,
  requirePermission("settings:manage"),
  validateObjectId("id"),
  updateEmployeeGroup
);

router.post(
  "/:id/sync-ledger",
  authenticate,
  requirePermission("settings:manage"),
  validateObjectId("id"),
  syncEmployeeLedger
);

router.post("/", authenticate, requirePermission("settings:manage"), createEmployee);
router.put(
  "/:id",
  authenticate,
  requirePermission("settings:manage"),
  validateObjectId("id"),
  updateEmployee
);
router.delete(
  "/:id",
  authenticate,
  requirePermission("settings:manage"),
  validateObjectId("id"),
  deleteEmployee
);
router.delete(
  "/:id/permanent",
  authenticate,
  requirePermission("settings:manage"),
  validateObjectId("id"),
  permanentlyDeleteEmployee
);

export default router;
