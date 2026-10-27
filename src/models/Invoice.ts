import { Schema, model, Document, Types } from "mongoose";
import { IContact } from "./Contact";
import { IProduct } from "./Product";

export interface IInvoiceItem {
  itemType: "product" | "service" | "custom";
  product?: Types.ObjectId | IProduct;
  description: string;
  hsnSac?: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxableAmount: number;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  total: number;
}

export interface IInvoicePayment {
  _id?: Types.ObjectId;
  paymentDate: Date;
  amount: number;
  paymentMode: "Cash" | "Bank" | "UPI" | "Cheque";
  account?: Types.ObjectId;
  transaction?: Types.ObjectId;
  reference?: string;
  notes?: string;
}

export interface IInvoice extends Document {
  _id: Types.ObjectId;
  docType: "Invoice" | "Quotation";
  docNumber: string;
  customer: Types.ObjectId | IContact;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  customerGstin?: string;
  customerState?: string;
  serviceTicket?: Types.ObjectId;
  items: IInvoiceItem[];
  subtotal: number;
  totalDiscount: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  taxTotal: number;
  roundOff: number;
  grandTotal: number;
  paidAmount: number;
  balanceDue: number;
  status:
    | "Draft"
    | "Sent"
    | "Unpaid"
    | "Partially Paid"
    | "Paid"
    | "Accepted"
    | "Declined"
    | "Converted"
    | "Cancelled";
  issueDate: Date;
  dueDate?: Date;
  convertedFromQuotation?: Types.ObjectId;
  convertedToInvoice?: Types.ObjectId;
  payments: IInvoicePayment[];
  notes?: string;
  terms?: string;
  bankDetails?: {
    bankName?: string;
    bankAccountNumber?: string;
    bankIfsc?: string;
    bankBranch?: string;
    upiId?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const invoiceItemSchema = new Schema<IInvoiceItem>(
  {
    itemType: {
      type: String,
      enum: ["product", "service", "custom"],
      default: "custom",
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
    },
    description: {
      type: String,
      required: [true, "Item description is required"],
      trim: true,
    },
    hsnSac: {
      type: String,
      trim: true,
      default: "",
    },
    quantity: {
      type: Number,
      required: true,
      min: [0.01, "Quantity must be greater than 0"],
      default: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, "Unit price cannot be negative"],
      default: 0,
    },
    discountPercent: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
      max: [100, "Discount cannot exceed 100%"],
    },
    taxableAmount: {
      type: Number,
      default: 0,
    },
    gstRate: {
      type: Number,
      default: 0,
      min: [0, "GST rate cannot be negative"],
    },
    cgstAmount: {
      type: Number,
      default: 0,
    },
    sgstAmount: {
      type: Number,
      default: 0,
    },
    igstAmount: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const invoicePaymentSchema = new Schema<IInvoicePayment>(
  {
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Amount must be greater than 0"],
    },
    paymentMode: {
      type: String,
      enum: ["Cash", "Bank", "UPI", "Cheque"],
      default: "Cash",
    },
    account: {
      type: Schema.Types.ObjectId,
      ref: "Account",
    },
    transaction: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
    },
    reference: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const invoiceSchema = new Schema<IInvoice>(
  {
    docType: {
      type: String,
      enum: ["Invoice", "Quotation"],
      required: true,
      default: "Invoice",
    },
    docNumber: {
      type: String,
      required: [true, "Document number is required"],
      trim: true,
      unique: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Contact",
      required: [true, "Customer reference is required"],
    },
    customerName: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
    },
    customerPhone: {
      type: String,
      trim: true,
    },
    customerAddress: {
      type: String,
      trim: true,
    },
    customerGstin: {
      type: String,
      trim: true,
      uppercase: true,
    },
    customerState: {
      type: String,
      trim: true,
    },
    serviceTicket: {
      type: Schema.Types.ObjectId,
      ref: "ServiceTicket",
    },
    items: {
      type: [invoiceItemSchema],
      default: [],
    },
    subtotal: {
      type: Number,
      default: 0,
    },
    totalDiscount: {
      type: Number,
      default: 0,
    },
    taxableTotal: {
      type: Number,
      default: 0,
    },
    cgstTotal: {
      type: Number,
      default: 0,
    },
    sgstTotal: {
      type: Number,
      default: 0,
    },
    igstTotal: {
      type: Number,
      default: 0,
    },
    taxTotal: {
      type: Number,
      default: 0,
    },
    roundOff: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      default: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    balanceDue: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: [
        "Draft",
        "Sent",
        "Unpaid",
        "Partially Paid",
        "Paid",
        "Accepted",
        "Declined",
        "Converted",
        "Cancelled",
      ],
      default: "Draft",
    },
    issueDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
    },
    convertedFromQuotation: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
    },
    convertedToInvoice: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
    },
    payments: {
      type: [invoicePaymentSchema],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
    },
    terms: {
      type: String,
      trim: true,
    },
    bankDetails: {
      bankName: { type: String, trim: true },
      bankAccountNumber: { type: String, trim: true },
      bankIfsc: { type: String, trim: true },
      bankBranch: { type: String, trim: true },
      upiId: { type: String, trim: true },
    },
  },
  {
    timestamps: true,
  }
);

invoiceSchema.index({ docNumber: 1 }, { unique: true });
invoiceSchema.index({ docType: 1 });
invoiceSchema.index({ customer: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ issueDate: -1 });
invoiceSchema.index({ "items.product": 1 });

const Invoice = model<IInvoice>("Invoice", invoiceSchema);

export default Invoice;
