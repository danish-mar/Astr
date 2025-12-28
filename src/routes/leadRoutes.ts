import { Router } from "express";
import * as leadController from "../controllers/leadController";

const router = Router();

router.get("/", leadController.getAllLeads);
router.get("/stats", leadController.getLeadStats);
router.get("/:id", leadController.getLeadById);
router.post("/", leadController.createLead);
router.put("/:id", leadController.updateLead);
router.delete("/:id", leadController.deleteLead);

export default router;
