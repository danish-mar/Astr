import { Router } from "express";
import * as accountingController from "../controllers/accountingController";

const router = Router();

// Financial Summary
router.get("/summary", accountingController.getAccountingSummary);

// All Accounts
router.get("/accounts", accountingController.getAllAccounts);

// Ledger for a Specific Account
router.get("/ledger/:accountId", accountingController.getAccountLedger);

// Process a Transaction
router.post("/transaction", accountingController.createTransaction);
router.put("/transaction/:transactionId", accountingController.updateTransaction);
router.delete("/transaction/:transactionId", accountingController.deleteTransaction);

// Tag Management
router.get("/tags", accountingController.getTags);
router.post("/tags", accountingController.createTag);
router.delete("/tags/:tagId", accountingController.deleteTag);

// Account Management (Ledger Setup)
router.post("/get-account", accountingController.getOrCreateAccount);

// Delete Account (Ledger)
router.put("/accounts/:accountId", accountingController.updateAccount);
router.delete("/accounts/:accountId", accountingController.deleteAccount);

// Contact Integration
router.get("/contact/:contactId", accountingController.getContactLedgers);

export default router;
