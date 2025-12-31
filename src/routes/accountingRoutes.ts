import { Router } from "express";
import * as accountingController from "../controllers/accountingController";
import { authenticate, requirePermission } from "../middleware";

const router = Router();

// Financial Summary
router.get("/summary", authenticate, requirePermission("accounting:read"), accountingController.getAccountingSummary);

// All Accounts
router.get("/accounts", authenticate, requirePermission("accounting:read"), accountingController.getAllAccounts);

// Ledger for a Specific Account
router.get("/ledger/:accountId", authenticate, requirePermission("accounting:read"), accountingController.getAccountLedger);

// Process a Transaction
router.post("/transaction", authenticate, requirePermission("accounting:write"), accountingController.createTransaction);
router.put("/transaction/:transactionId", authenticate, requirePermission("accounting:write"), accountingController.updateTransaction);
router.delete("/transaction/:transactionId", authenticate, requirePermission("accounting:write"), accountingController.deleteTransaction);

// Tag Management
router.get("/tags", authenticate, requirePermission("accounting:read"), accountingController.getTags);
router.post("/tags", authenticate, requirePermission("accounting:write"), accountingController.createTag);
router.delete("/tags/:tagId", authenticate, requirePermission("accounting:write"), accountingController.deleteTag);

// Account Management (Ledger Setup)
router.post("/get-account", authenticate, requirePermission("accounting:write"), accountingController.getOrCreateAccount);

// Delete Account (Ledger)
router.put("/accounts/:accountId", authenticate, requirePermission("accounting:write"), accountingController.updateAccount);
router.delete("/accounts/:accountId", authenticate, requirePermission("accounting:write"), accountingController.deleteAccount);

// Contact Integration
router.get("/contact/:contactId", authenticate, requirePermission("accounting:read"), accountingController.getContactLedgers);

export default router;
