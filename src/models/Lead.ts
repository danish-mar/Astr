import { Schema, model, Document, Types } from "mongoose";
import { IContact } from "./Contact";
import { IProduct } from "./Product";

export interface ILeadLog {
    status: string;
    label: string;
    note?: string;
    timestamp: Date;
}

export interface ILead extends Document {
    _id: Types.ObjectId;
    leadID: string;
    customer: Types.ObjectId | IContact;
    product: Types.ObjectId | IProduct;
    status: "New" | "Contacted" | "Qualified" | "Negotiation" | "Closed Won" | "Closed Lost";
    notes?: string;
    estimatedValue?: number;
    source?: string;
    logs: ILeadLog[];
    closedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

function generateLeadID(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous characters
    let result = "";
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

const leadSchema = new Schema<ILead>(
    {
        leadID: {
            type: String,
            unique: true,
            uppercase: true,
            minlength: 6,
            maxlength: 6,
        },
        customer: {
            type: Schema.Types.ObjectId,
            ref: "Contact",
            required: [true, "Customer is required"],
        },
        product: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: [true, "Product is required"],
        },
        status: {
            type: String,
            required: true,
            enum: {
                values: ["New", "Contacted", "Qualified", "Negotiation", "Closed Won", "Closed Lost"],
                message: "{VALUE} is not a valid lead status",
            },
            default: "New",
        },
        notes: {
            type: String,
            trim: true,
        },
        estimatedValue: {
            type: Number,
            default: 0,
        },
        source: {
            type: String,
            trim: true,
        },
        logs: [
            {
                status: { type: String, required: true },
                label: { type: String, required: true },
                note: { type: String },
                timestamp: { type: Date, default: Date.now },
            },
        ],
        closedAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// leadID index is automatically created by unique: true
leadSchema.index({ customer: 1 });

leadSchema.index({ product: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ createdAt: -1 });

leadSchema.pre("save", async function () {
    if (this.isNew) {
        let isUnique = false;
        let newID = "";
        while (!isUnique) {
            newID = generateLeadID();
            const existing = await model("Lead").findOne({ leadID: newID });
            if (!existing) {
                isUnique = true;
            }
        }
        this.leadID = newID;
    }

    if (this.isModified("status")) {
        if ((this.status === "Closed Won" || this.status === "Closed Lost") && !this.closedAt) {
            this.closedAt = new Date();
        }
    }
});

const Lead = model<ILead>("Lead", leadSchema);

export default Lead;
