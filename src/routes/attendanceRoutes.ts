import { Router } from "express";
import {
    checkIn,
    checkOut,
    getTodayStatus,
    getAttendanceHistory,
    calculatePayroll,
    getTodayActiveEmployees,
} from "../controllers/attendanceController";
import { authenticate, authorize, requirePermission } from "../middleware";

const router = Router();

// Self routes
router.post("/check-in", authenticate, checkIn);
router.post("/check-out", authenticate, checkOut);
router.get("/status", authenticate, getTodayStatus);
router.get("/aura", authenticate, getTodayActiveEmployees);
router.get("/history", authenticate, getAttendanceHistory);

// Admin/Manager routes
router.get("/history/:id", authenticate, requirePermission("attendance:view_all"), getAttendanceHistory);
router.get("/payroll", authenticate, requirePermission("payroll:manage"), calculatePayroll);

export default router;
