import { Schema, model, Document, Types, Model } from "mongoose";

// 1. Define TypeScript interface for Shop Settings document
export interface IShopSettings extends Document {
  _id: Types.ObjectId;
  shopName: string;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string;
  updatedAt: Date;
}

// 2. Create the Mongoose schema
const shopSettingsSchema = new Schema<IShopSettings>(
  {
    shopName: {
      type: String,
      required: [true, "Shop name is required"],
      trim: true,
      minlength: [2, "Shop name must be at least 2 characters long"],
      default: "Astr Computer Shop",
    },
    address: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: function (v: string) {
          // Optional field, but if provided must be valid
          if (!v) return true;
          return /^[0-9]{10}$/.test(v);
        },
        message: "Please enter a valid 10-digit phone number",
      },
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      validate: {
        validator: function (v: string) {
          // Optional field, but if provided must be valid email
          if (!v) return true;
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: "Please enter a valid email address",
      },
    },
    logo: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true }, // Only track updates, not creation
  }
);

// 3. Ensure only one settings document exists (Singleton pattern)
shopSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();

  // If no settings exist, create default settings
  if (!settings) {
    settings = await this.create({
      shopName: "Astr Computer Shop",
    });
  }

  return settings;
};

// 4. Static method to update settings
shopSettingsSchema.statics.updateSettings = async function (
  updates: Partial<IShopSettings>
) {
  let settings = await this.findOne();

  if (!settings) {
    settings = await this.create(updates);
  } else {
    Object.assign(settings, updates);
    await settings.save();
  }

  return settings;
};

// 5. Prevent multiple settings documents
// 5. Prevent multiple settings documents
shopSettingsSchema.pre("save", async function () {
  const count = await model("ShopSettings").countDocuments();

  // Allow save if this is the first document or if updating existing
  if (count === 0 || !this.isNew) {
    return;
  } else {
    throw new Error(
      "Only one shop settings document is allowed. Use updateSettings() method."
    );
  }
});

// 6. Create and export the model
// 6. Define interface for Shop Settings Model with static methods
interface IShopSettingsModel extends Model<IShopSettings> {
  getSettings(): Promise<IShopSettings>;
  updateSettings(updates: Partial<IShopSettings>): Promise<IShopSettings>;
}

// 7. Create and export the model
const ShopSettings = model<IShopSettings, IShopSettingsModel>(
  "ShopSettings",
  shopSettingsSchema
);

export default ShopSettings;
