import { Schema, model, Document, Types } from "mongoose";

export interface IWhatsAppInquiryItem {
  name: string;
  categoryName?: string;
  inStock?: boolean;
  vendorPrice?: number;
  quotedPrice?: number;
  marginPercent?: number;
}

export interface IWhatsAppInquiry extends Document {
  _id: Types.ObjectId;
  customerPhone: string;
  customerRealPhone?: string;
  customerName?: string;
  status: "inquiry" | "awaiting_vendor" | "quoted" | "deal_agreed" | "closed";
  requestedProduct: string;
  categoryName?: string;
  items?: IWhatsAppInquiryItem[];
  vendorPhone?: string;
  vendorName?: string;
  vendorPrice?: number;
  quotedPrice?: number;
  marginPercent?: number;
  history: Array<{
    sender: "customer" | "agent" | "vendor" | "boss";
    message: string;
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const whatsAppInquirySchema = new Schema<IWhatsAppInquiry>(
  {
    customerPhone: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    customerRealPhone: {
      type: String,
      trim: true,
    },
    customerName: {
      type: String,
      default: "Customer",
      trim: true,
    },
    status: {
      type: String,
      enum: ["inquiry", "awaiting_vendor", "quoted", "deal_agreed", "closed"],
      default: "inquiry",
      index: true,
    },
    requestedProduct: {
      type: String,
      required: true,
      trim: true,
    },
    categoryName: {
      type: String,
      trim: true,
    },
    items: [
      {
        name: { type: String, required: true },
        categoryName: { type: String },
        inStock: { type: Boolean, default: false },
        vendorPrice: { type: Number },
        quotedPrice: { type: Number },
        marginPercent: { type: Number },
      },
    ],
    vendorPhone: {
      type: String,
      trim: true,
    },
    vendorName: {
      type: String,
      trim: true,
    },
    vendorPrice: {
      type: Number,
    },
    quotedPrice: {
      type: Number,
    },
    marginPercent: {
      type: Number,
    },
    history: [
      {
        sender: {
          type: String,
          enum: ["customer", "agent", "vendor", "boss"],
          required: true,
        },
        message: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default model<IWhatsAppInquiry>("WhatsAppInquiry", whatsAppInquirySchema);
