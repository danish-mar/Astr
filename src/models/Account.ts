import { Schema, model, Document, Types } from "mongoose";

export interface IAccount extends Document {
    contact: Types.ObjectId;
    accountName: string;
    accountType: "Payable" | "Receivable" | "Operational";
    description?: string;
    totalBalance: number; // Credit - Debit
    createdAt: Date;
    updatedAt: Date;
}

const accountSchema = new Schema<IAccount>(
    {
        contact: {
            type: Schema.Types.ObjectId,
            ref: "Contact",
            required: [true, "Contact is required for a Ledger account"],
        },
        accountName: {
            type: String,
            required: [true, "Account name is required"],
            trim: true,
        },
        accountType: {
            type: String,
            required: [true, "Account type is required"],
            enum: ["Payable", "Receivable", "Operational"],
            default: "Operational",
        },
        description: {
            type: String,
            trim: true,
        },
        totalBalance: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

// Indexing for faster lookups
accountSchema.index({ contact: 1 });
accountSchema.index({ accountType: 1 });

const Account = model<IAccount>("Account", accountSchema);

export default Account;
