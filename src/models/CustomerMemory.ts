import { Schema, model, Document, Types } from "mongoose";

export interface IConversationTurn {
  role: "customer" | "agent";
  message: string;
  timestamp: Date;
}

export interface ICustomerMemory extends Document {
  _id: Types.ObjectId;
  /** Canonical WhatsApp JID (e.g. 919876543210@c.us or @lid) */
  chatId: string;
  /** Resolved actual customer phone number (e.g. 923167255624 or 919876543210) */
  realPhone?: string;
  /** 10-digit last-digits phone for fuzzy matching */
  phone10: string;
  /** Display name from WhatsApp notify */
  name: string;
  /** Language/style fingerprint: "hindi", "english", "hinglish" */
  detectedLanguage: "english" | "hinglish" | "hindi" | "unknown";
  /** Products they've asked about before */
  pastInquiries: string[];
  /** Full conversation history (rolling last 30 turns) */
  history: IConversationTurn[];
  /** Notes about preferences, e.g. "prefers budget options", "wants gaming laptop" */
  preferences: string[];
  /** How many times they've messaged us */
  messageCount: number;
  /** ID of most recent active inquiry */
  activeInquiryId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const customerMemorySchema = new Schema<ICustomerMemory>(
  {
    chatId: { type: String, required: true, unique: true, index: true, trim: true },
    realPhone: { type: String, trim: true },
    phone10: { type: String, required: true, index: true, trim: true },
    name: { type: String, default: "Customer", trim: true },
    detectedLanguage: {
      type: String,
      enum: ["english", "hinglish", "hindi", "unknown"],
      default: "unknown",
    },
    pastInquiries: [{ type: String, trim: true }],
    history: [
      {
        role: { type: String, enum: ["customer", "agent"], required: true },
        message: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    preferences: [{ type: String, trim: true }],
    messageCount: { type: Number, default: 0 },
    activeInquiryId: { type: Schema.Types.ObjectId, ref: "WhatsAppInquiry" },
  },
  { timestamps: true }
);

export default model<ICustomerMemory>("CustomerMemory", customerMemorySchema);
