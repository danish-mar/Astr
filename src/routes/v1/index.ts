import { Router } from "express";
import contactRoutes from "../contactRoutes";
import categoryRoutes from "../categoryRoutes";
import productRoutes from "../productRoutes";
import serviceTicketRoutes from "../serviceTicketRoutes";
import shopSettingsRoutes from "../shopSettingsRoutes";
import employeeRoutes from "../employeeRoutes";
import statisticsRoutes from "../statisticsRoutes";
import aiRoutes from "../aiRoutes";
import leadRoutes from "../leadRoutes";
import expenditureRoutes from "../expenditureRoutes";
import accountingRoutes from "../accountingRoutes";
import attendanceRoutes from "../attendanceRoutes";
import searchRoutes from "../searchRoutes";


const router = Router();

// Mount all routes
router.use("/contacts", contactRoutes);
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/service-tickets", serviceTicketRoutes);
router.use("/settings", shopSettingsRoutes);
router.use("/employees", employeeRoutes);
router.use("/statistics", statisticsRoutes);
router.use("/ai", aiRoutes);
router.use("/leads", leadRoutes);
router.use("/expenditures", expenditureRoutes);
router.use("/accounting", accountingRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/search", searchRoutes);


export default router;
