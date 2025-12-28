import { Router } from "express";
import * as expenditureController from "../controllers/expenditureController";
import { authenticate } from "../middleware/auth";

const router = Router();

// All expenditure routes are protected
router.use(authenticate);

router.get("/stats", expenditureController.getExpenditureStats);

router
    .route("/")
    .get(expenditureController.getAllExpenditures)
    .post(expenditureController.createExpenditure);

router
    .route("/:id")
    .patch(expenditureController.updateExpenditure)
    .delete(expenditureController.deleteExpenditure);

export default router;
