import { Schema, model, Document, Types } from "mongoose";

export interface IExpenditure extends Document {
    title: string;
    amount: number;
    category: "Snacks" | "Tea" | "Tools" | "Transport" | "Miscellaneous" | "Ad-hoc";
    date: Date;
    description?: string;
    addedBy: Types.ObjectId; // Reference to Employee
    createdAt: Date;
    updatedAt: Date;
}

const expenditureSchema = new Schema<IExpenditure>(
    {
        title: {
            type: String,
            required: [true, "Description/Title is required"],
            trim: true,
        },
        amount: {
            type: Number,
            required: [true, "Amount is required"],
            min: [0, "Amount cannot be negative"],
        },
        category: {
            type: String,
            required: [true, "Category is required"],
            enum: ["Snacks", "Tea", "Tools", "Transport", "Miscellaneous", "Ad-hoc"],
            default: "Miscellaneous",
        },
        date: {
            type: Date,
            default: Date.now,
        },
        description: {
            type: String,
            trim: true,
        },
        addedBy: {
            type: Schema.Types.ObjectId,
            ref: "Employee",
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Index for faster reporting by date
expenditureSchema.index({ date: -1 });
expenditureSchema.index({ category: 1 });

const Expenditure = model<IExpenditure>("Expenditure", expenditureSchema);

export default Expenditure;
