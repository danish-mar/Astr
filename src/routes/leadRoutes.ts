import { Router } from "express";
import * as leadController from "../controllers/leadController";
import { authenticate, requirePermission } from "../middleware";

const router = Router();

router.get("/", authenticate, requirePermission("leads:read"), leadController.getAllLeads);
router.get("/stats", authenticate, requirePermission("leads:read"), leadController.getLeadStats);
router.get("/:id", authenticate, requirePermission("leads:read"), leadController.getLeadById);

router.post("/", authenticate, requirePermission("leads:write"), leadController.createLead);
router.put("/:id", authenticate, requirePermission("leads:write"), leadController.updateLead);
router.delete("/:id", authenticate, requirePermission("leads:write"), leadController.deleteLead);

export default router;
