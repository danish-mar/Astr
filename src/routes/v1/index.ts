import { Router } from "express";
import contactRoutes from "../contactRoutes";
import categoryRoutes from "../categoryRoutes";
import productRoutes from "../productRoutes";
import serviceTicketRoutes from "../serviceTicketRoutes";
import shopSettingsRoutes from "../shopSettingsRoutes";
import employeeRoutes from "../employeeRoutes";

const router = Router();

// Mount all routes
router.use("/contacts", contactRoutes);
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/service-tickets", serviceTicketRoutes);
router.use("/settings", shopSettingsRoutes);
router.use("/employees", employeeRoutes);

export default router;
