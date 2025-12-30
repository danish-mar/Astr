import { Schema, model, Document, Types } from "mongoose";

export interface ITransaction extends Document {
    account: Types.ObjectId;
    amount: number;
    transactionType: "Credit" | "Debit";
    date: Date;
    tag?: Types.ObjectId;
    description?: string;
    reference?: string; // Invoice #, Receipt #, etc.
    serviceTicket?: Types.ObjectId; // Link to Service Ticket
    createdAt: Date;
    updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
    {
        account: {
            type: Schema.Types.ObjectId,
            ref: "Account",
            required: [true, "Account reference is required"],
        },
        amount: {
            type: Number,
            required: [true, "Transaction amount is required"],
            min: [0, "Amount cannot be negative"],
        },
        transactionType: {
            type: String,
            required: [true, "Transaction type is required"],
            enum: ["Credit", "Debit"],
        },
        date: {
            type: Date,
            default: Date.now,
        },
        tag: {
            type: Schema.Types.ObjectId,
            ref: "Tag",
        },
        description: {
            type: String,
            trim: true,
        },
        reference: {
            type: String,
            trim: true,
        },
        serviceTicket: {
            type: Schema.Types.ObjectId,
            ref: "ServiceTicket",
        },
    },
    {
        timestamps: true,
    }
);

// Indexing
transactionSchema.index({ account: 1 });
transactionSchema.index({ date: -1 });
transactionSchema.index({ transactionType: 1 });

const Transaction = model<ITransaction>("Transaction", transactionSchema);

export default Transaction;
