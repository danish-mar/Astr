import { Schema, model, Document, Types } from "mongoose";

// 1. Define TypeScript interface for Contact document
export interface IContact extends Document {
  _id: Types.ObjectId;
  name: string;
  phone: string;
  contactType: "Vendor" | "Customer" | "Supplier" | "Custom" | "Employee";
  address?: string;
  companyName?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 2. Create the Mongoose schema
const contactSchema = new Schema<IContact>(
  {
    name: {
      type: String,
      required: [true, "Contact name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters long"],
    },
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: function (v: string | null | undefined) {
          // If no phone is provided, skip validation (it's optional now)
          if (!v) return true;
          // Basic phone validation (10 digits for India)
          return /^[0-9]{10}$/.test(v);
        },
        message: "Please enter a valid 10-digit phone number",
      },
    },
    contactType: {
      type: String,
      required: [true, "Contact type is required"],
      enum: {
        values: ["Vendor", "Customer", "Supplier", "Custom", "Employee"],
        message: "{VALUE} is not a valid contact type",
      },
    },
    address: {
      type: String,
      trim: true,
    },
    companyName: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// 3. Add indexes for better query performance
contactSchema.index({ name: 1 });
contactSchema.index({ phone: 1 });
contactSchema.index({ contactType: 1 });

// 4. Add a compound index for searching by type and name
contactSchema.index({ contactType: 1, name: 1 });

// 5. Create and export the model
const Contact = model<IContact>("Contact", contactSchema);

export default Contact;
