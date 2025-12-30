import { Schema, model, Document } from "mongoose";

export interface ITag extends Document {
    name: string;
    color: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}

const tagSchema = new Schema<ITag>(
    {
        name: {
            type: String,
            required: [true, "Tag name is required"],
            unique: true,
            trim: true,
        },
        color: {
            type: String,
            default: "#6366f1", // Indigo-500
        },
        description: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

const Tag = model<ITag>("Tag", tagSchema);

export default Tag;
