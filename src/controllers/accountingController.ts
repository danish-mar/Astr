import { Request, Response } from "express";
import { Account, Transaction, Contact, Tag } from "../models";
import { handleError, sendSuccess, sendError } from "../utils";
import mongoose from "mongoose";

/**
 * Get Overall Financial Summary (Total Payables & Receivables)
 */
export const getAccountingSummary = async (req: Request, res: Response) => {
    try {
        const accounts = await Account.find({});
        
        const formattedSummary = {
            totalPayable: 0,
            totalReceivable: 0,
            netBalance: 0
        };

        accounts.forEach(acc => {
            const balance = acc.totalBalance || 0;
            if (balance > 0) {
                formattedSummary.totalPayable += balance;
            } else if (balance < 0) {
                formattedSummary.totalReceivable += Math.abs(balance);
            }
        });

        // Net Position = Assets (Receivables) - Liabilities (Payables)
        // If Receivables (They owe us) > Payables (We owe them) -> Positive (Debit/Welfare)
        formattedSummary.netBalance = formattedSummary.totalReceivable - formattedSummary.totalPayable;

        console.log("[Accounting] Summary Re-computed (Balance Based):", formattedSummary);

        return sendSuccess(res, formattedSummary, "Accounting summary fetched successfully");
    } catch (error) {
        console.error("[Accounting] Summary Failure:", error);
        return handleError(error, res);
    }
};

/**
 * Get All Accounts with Contact details
 */
export const getAllAccounts = async (req: Request, res: Response) => {
    try {
        const accounts = await Account.find().populate("contact", "name phone contactType companyName");
        return sendSuccess(res, accounts, "Accounts fetched successfully");
    } catch (error) {
        return handleError(error, res);
    }
};

/**
 * Get Ledger for a Specific Account with Date Filtering
 */
export const getAccountLedger = async (req: Request, res: Response) => {
    try {
        const { accountId } = req.params;
        const { startDate, endDate } = req.query;

        const filter: any = { account: accountId };

        if (startDate || endDate) {
            filter.date = {};
            if (startDate) filter.date.$gte = new Date(startDate as string);
            if (endDate) {
                const end = new Date(endDate as string);
                end.setHours(23, 59, 59, 999);
                filter.date.$lte = end;
            }
        }

        const transactions = await Transaction.find(filter)
            .populate("tag", "name color")
            .sort({ date: -1 });

        const account = await Account.findById(accountId).populate("contact");

        // Simple aggregation for stats in this period
        const periodStats = transactions.reduce((acc, tx) => {
            if (tx.transactionType === "Credit") acc.totalTook += tx.amount;
            else acc.totalGave += tx.amount;
            return acc;
        }, { totalTook: 0, totalGave: 0, count: transactions.length });

        return sendSuccess(res, { account, transactions, periodStats }, "Ledger fetched successfully");
    } catch (error) {
        return handleError(error, res);
    }
};

/**
 * Create a New Transaction and sync Account Balance (Simple Mode)
 */
export const createTransaction = async (req: Request, res: Response) => {
    try {
        const { accountId, amount, transactionType, date, tagId, description, reference } = req.body;

        const account = await Account.findById(accountId);
        if (!account) {
            return sendError(res, "Account not found", 404);
        }

        const transaction = new Transaction({
            account: accountId,
            amount: Number(amount),
            transactionType,
            date: date || new Date(),
            tag: tagId || null,
            description,
            reference
        });

        await transaction.save();

        // Update Account Balance Simply
        // Credit increases balance (Liability/Took)
        // Debit decreases balance (Asset/Payment/Gave)
        const balanceChange = transactionType === "Credit" ? Number(amount) : -Number(amount);
        account.totalBalance += balanceChange;

        await account.save();

        return sendSuccess(res, transaction, "Transaction recorded successfully");
    } catch (error) {
        return handleError(error, res);
    }
};

/**
 * Create or Fetch Account for a Contact
 */
export const getOrCreateAccount = async (req: Request, res: Response) => {
    try {
        const { contactId, accountType, accountName } = req.body;

        let account = await Account.findOne({ contact: contactId, accountType });

        if (!account) {
            const contact = await Contact.findById(contactId);
            if (!contact) return sendError(res, "Contact not found", 404);

            account = new Account({
                contact: contactId,
                accountType: accountType || (contact.contactType === "Customer" ? "Receivable" : "Payable"),
                accountName: accountName || `${contact.name}'s Account`,
                totalBalance: 0
            });
            await account.save();
        }

        return sendSuccess(res, account, "Account ready");
    } catch (error) {
        return handleError(error, res);
    }
};

/**
 * Update a Transaction and Recalculate Account Balance
 */
export const updateTransaction = async (req: Request, res: Response) => {
    try {
        const { transactionId } = req.params;
        const { amount, transactionType, date, tagId, description, reference } = req.body;

        const transaction = await Transaction.findById(transactionId);
        if (!transaction) return sendError(res, "Transaction not found", 404);

        const account = await Account.findById(transaction.account);
        if (!account) return sendError(res, "Account not found", 404);

        // 1. Revert Old Balance
        const oldBalanceChange = transaction.transactionType === "Credit" ? transaction.amount : -transaction.amount;
        account.totalBalance -= oldBalanceChange;

        // 2. Update Transaction
        if (amount !== undefined) transaction.amount = Number(amount);
        if (transactionType !== undefined) transaction.transactionType = transactionType;
        if (date !== undefined) transaction.date = date;
        if (tagId !== undefined) transaction.tag = tagId || null;
        if (description !== undefined) transaction.description = description;
        if (reference !== undefined) transaction.reference = reference;

        await transaction.save();

        // 3. Apply New Balance
        const newBalanceChange = transaction.transactionType === "Credit" ? transaction.amount : -transaction.amount;
        account.totalBalance += newBalanceChange;

        await account.save();

        return sendSuccess(res, transaction, "Transaction updated successfully");
    } catch (error) {
        return handleError(error, res);
    }
};

/**
 * Delete a Transaction and Revert Account Balance
 */
export const deleteTransaction = async (req: Request, res: Response) => {
    try {
        const { transactionId } = req.params;

        const transaction = await Transaction.findById(transactionId);
        if (!transaction) return sendError(res, "Transaction not found", 404);

        const account = await Account.findById(transaction.account);
        if (!account) return sendError(res, "Account not found", 404);

        // Revert Balance
        const balanceChange = transaction.transactionType === "Credit" ? transaction.amount : -transaction.amount;
        account.totalBalance -= balanceChange;

        await account.save();
        await Transaction.findByIdAndDelete(transactionId);

        return sendSuccess(res, null, "Transaction deleted and balance reverted");
    } catch (error) {
        return handleError(error, res);
    }
};
/**
 * Tag Management: Get All Tags
 */
export const getTags = async (req: Request, res: Response) => {
    try {
        const tags = await Tag.find().sort({ name: 1 });
        return sendSuccess(res, tags, "Tags fetched successfully");
    } catch (error) {
        return handleError(error, res);
    }
};

/**
 * Tag Management: Create a new Tag
 */
export const createTag = async (req: Request, res: Response) => {
    try {
        const { name, color } = req.body;
        const tag = new Tag({ name, color });
        await tag.save();
        return sendSuccess(res, tag, "Tag created successfully");
    } catch (error) {
        return handleError(error, res);
    }
};

/**
 * Tag Management: Delete a Tag
 */
export const deleteTag = async (req: Request, res: Response) => {
    try {
        const { tagId } = req.params;
        await Tag.findByIdAndDelete(tagId);
        // Optional: Remove tag reference from transactions
        await Transaction.updateMany({ tag: tagId }, { $set: { tag: null } });
        return sendSuccess(res, null, "Tag deleted successfully");
    } catch (error) {
        return handleError(error, res);
    }
};

/**
 * Delete a Ledger Account (Secure Flow)
 */
export const deleteAccount = async (req: Request, res: Response) => {
    try {
        const { accountId } = req.params;
        const account = await Account.findById(accountId);

        if (!account) return sendError(res, "Account not found", 404);

        // Security Check: If balance is not zero, require confirmation (handled by frontend)
        // Here we just perform the deletion of account and its transactions
        await Transaction.deleteMany({ account: accountId });
        await Account.findByIdAndDelete(accountId);

        return sendSuccess(res, null, "Ledger and associated transactions deleted");
    } catch (error) {
        return handleError(error, res);
    }
};

/**
 * Update Ledger Account Settings
 */
export const updateAccount = async (req: Request, res: Response) => {
    try {
        const { accountId } = req.params;
        const { accountName, accountType } = req.body;

        const account = await Account.findById(accountId);
        if (!account) return sendError(res, "Account not found", 404);

        if (accountName) account.accountName = accountName;
        if (accountType) account.accountType = accountType;

        await account.save();
        return sendSuccess(res, account, "Account updated successfully");
    } catch (error) {
        return handleError(error, res);
    }
};

/**
 * Get all ledgers associated with a contact (for CRM integration)
 */
export const getContactLedgers = async (req: Request, res: Response) => {
    try {
        const { contactId } = req.params;
        const accounts = await Account.find({ contact: contactId });

        // Enhance with recent transactions for each account
        const enrichedAccounts = await Promise.all(accounts.map(async (acc) => {
            const recentTransactions = await Transaction.find({ account: acc._id })
                .sort({ date: -1 })
                .limit(5)
                .populate("tag", "name");
            return {
                ...acc.toObject(),
                recentTransactions
            };
        }));

        return sendSuccess(res, enrichedAccounts, "Contact ledgers fetched");
    } catch (error) {
        return handleError(error, res);
    }
};
