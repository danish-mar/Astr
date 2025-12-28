import { Schema, model, Document, Types } from "mongoose";
import { IContact } from "./Contact";
import { ICategory } from "./Category";

// 1. Define TypeScript interface for Product document
export interface IProduct extends Document {
  _id: Types.ObjectId;
  productID?: string;
  name: string;
  category: Types.ObjectId | ICategory;
  source: Types.ObjectId | IContact;
  price: number;
  specifications: Map<string, any>;
  tags: string[];
  isSold: boolean;
  soldDate?: Date;
  notes?: string;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
}


// 2. Function to generate random 6-character alphanumeric ID
function generateProductID(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result.toUpperCase();
}

// 3. Create the Mongoose schema
const productSchema = new Schema<IProduct>(
  {
    productID: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values (when productID is not assigned)
      uppercase: true,
      minlength: 6,
      maxlength: 6,
    },
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      minlength: [2, "Product name must be at least 2 characters long"],
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },
    source: {
      type: Schema.Types.ObjectId,
      ref: "Contact",
      required: [true, "Source contact is required"],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      default: 0,
    },
    specifications: {
      type: Map,
      of: Schema.Types.Mixed,
      default: new Map(),
    },
    tags: {
      type: [String],
      default: [],
    },
    isSold: {
      type: Boolean,
      default: false,
    },
    soldDate: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
    },
    images: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, flattenMaps: true },
    toObject: { virtuals: true, flattenMaps: true }
  }
);


// 4. Add indexes for better query performance
// productID is already indexed by unique: true
productSchema.index({ category: 1 });
productSchema.index({ source: 1 });
productSchema.index({ price: 1 });
productSchema.index({ isSold: 1 });
productSchema.index({ tags: 1 });

// 5. Compound indexes for common queries
productSchema.index({ category: 1, isSold: 1 });
productSchema.index({ isSold: 1, createdAt: -1 });

// 6. Pre-save hook to auto-generate productID if requested
// 6. Pre-save hook to auto-generate productID if requested
productSchema.pre("save", async function () {
  // Only generate if productID is explicitly set to empty string or undefined but requested
  if (this.isNew && this.productID === "") {
    let isUnique = false;
    let newID = "";

    // Keep generating until we get a unique ID
    while (!isUnique) {
      newID = generateProductID();
      const existing = await model("Product").findOne({ productID: newID });
      if (!existing) {
        isUnique = true;
      }
    }

    this.productID = newID;
  }

  // Auto-set soldDate when marking as sold
  if (this.isModified("isSold") && this.isSold && !this.soldDate) {
    this.soldDate = new Date();
  }
});

// 7. Instance method to generate and assign productID
productSchema.methods.assignProductID = async function () {
  if (this.productID) {
    throw new Error("Product already has an ID assigned");
  }

  let isUnique = false;
  let newID = "";

  while (!isUnique) {
    newID = generateProductID();
    const existing = await model("Product").findOne({ productID: newID });
    if (!existing) {
      isUnique = true;
    }
  }

  this.productID = newID;
  await this.save();
  return newID;
};

// 8. Create and export the model
const Product = model<IProduct>("Product", productSchema);

export default Product;
export { generateProductID };
