import { Schema, model, Document, Types } from "mongoose";

// 1. Define interface for specification template fields
export interface ISpecificationField {
  fieldName: string;
  fieldType: "text" | "number" | "select" | "textarea";
  options?: (string | ISpecificationOption)[]; // For select type fields
  required?: boolean;
}

// 2. Define TypeScript interface for Category document
export interface ICategory extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  specificationsTemplate: ISpecificationField[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ISpecificationOption {
  value: string;
  subOptions?: string[]; // Legacy
  linkedFields?: ISpecificationField[]; // New recursive structure
}

// 3. Create the Mongoose schema
const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      unique: true,
      trim: true,
      minlength: [2, "Category name must be at least 2 characters long"],
    },
    description: {
      type: String,
      trim: true,
    },
    specificationsTemplate: [
      {
        fieldName: {
          type: String,
          required: true,
          trim: true,
        },
        fieldType: {
          type: String,
          required: true,
          enum: {
            values: ["text", "number", "select", "textarea"],
            message: "{VALUE} is not a valid field type",
          },
          default: "text",
        },
        options: {
          type: [Schema.Types.Mixed], // Allows strings or objects with subOptions & linkedFields
          default: undefined,
        },
        required: {
          type: Boolean,
          default: false,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// 4. Add indexes
// name is already indexed by unique: true

// 5. Add a pre-save hook to handle unique name validation better
// 5. Add a pre-save hook to handle unique name validation better
categorySchema.pre("save", async function () {
  if (this.isModified("name")) {
    this.name = this.name.charAt(0).toUpperCase() + this.name.slice(1);
  }
});

// 6. Create and export the model
const Category = model<ICategory>("Category", categorySchema);

export default Category;
