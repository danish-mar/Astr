import { Schema, model, Document, Types } from "mongoose";
import { IContact } from "./Contact";

// 1. Define TypeScript interface for Service Ticket document
export interface IServiceTicket extends Document {
  _id: Types.ObjectId;
  ticketNumber: string;
  customer: Types.ObjectId | IContact;
  deviceDetails: string;
  status: "Pending" | "In Progress" | "Completed" | "Delivered" | "Cancelled";
  assignedTechnician?: string;
  serviceCharge?: number;
  notes?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 2. Function to generate random 6-digit ticket number
function generateTicketNumber(): string {
  const min = 100000;
  const max = 999999;
  return Math.floor(Math.random() * (max - min + 1) + min).toString();
}

// 3. Create the Mongoose schema
const serviceTicketSchema = new Schema<IServiceTicket>(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      length: 6,
      validate: {
        validator: function (v: string) {
          return /^[0-9]{6}$/.test(v);
        },
        message: "Ticket number must be exactly 6 digits",
      },
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Contact",
      required: [true, "Customer is required"],
    },
    deviceDetails: {
      type: String,
      required: [true, "Device details are required"],
      trim: true,
      minlength: [5, "Device details must be at least 5 characters long"],
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: [
          "Pending",
          "In Progress",
          "Completed",
          "Delivered",
          "Cancelled",
        ],
        message: "{VALUE} is not a valid status",
      },
      default: "Pending",
    },
    assignedTechnician: {
      type: String,
      trim: true,
    },
    serviceCharge: {
      type: Number,
      min: [0, "Service charge cannot be negative"],
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// 4. Add indexes for better query performance
serviceTicketSchema.index({ ticketNumber: 1 });
serviceTicketSchema.index({ customer: 1 });
serviceTicketSchema.index({ status: 1 });
serviceTicketSchema.index({ createdAt: -1 });

// 5. Compound indexes for common queries
serviceTicketSchema.index({ status: 1, createdAt: -1 });
serviceTicketSchema.index({ customer: 1, status: 1 });

// 6. Pre-save hook to auto-generate ticket number and set completedAt
// 6. Pre-save hook to auto-generate ticket number and set completedAt
serviceTicketSchema.pre("save", async function () {
  // Generate unique ticket number for new tickets
  if (this.isNew) {
    let isUnique = false;
    let newTicketNumber = "";

    // Keep generating until we get a unique ticket number
    while (!isUnique) {
      newTicketNumber = generateTicketNumber();
      const existing = await model("ServiceTicket").findOne({
        ticketNumber: newTicketNumber,
      });
      if (!existing) {
        isUnique = true;
      }
    }

    this.ticketNumber = newTicketNumber;
  }

  // Auto-set completedAt when status changes to Completed or Delivered
  if (this.isModified("status")) {
    if (
      (this.status === "Completed" || this.status === "Delivered") &&
      !this.completedAt
    ) {
      this.completedAt = new Date();
    }
  }
});

// 7. Validate customer is of type 'Customer' before saving
// 7. Validate customer is of type 'Customer' before saving
serviceTicketSchema.pre("save", async function () {
  if (this.isModified("customer") || this.isNew) {
    const Contact = model("Contact");
    const customer = await Contact.findById(this.customer);

    if (!customer) {
      throw new Error("Customer not found");
    }

    if (customer.contactType !== "Customer") {
      throw new Error('Selected contact must be of type "Customer"');
    }
  }
});

// 8. Instance method to update status
serviceTicketSchema.methods.updateStatus = async function (newStatus: string) {
  const validStatuses = [
    "Pending",
    "In Progress",
    "Completed",
    "Delivered",
    "Cancelled",
  ];

  if (!validStatuses.includes(newStatus)) {
    throw new Error("Invalid status");
  }

  this.status = newStatus;
  await this.save();
  return this;
};

// 9. Static method to get tickets by status
serviceTicketSchema.statics.findByStatus = function (status: string) {
  return this.find({ status }).populate("customer").sort({ createdAt: -1 });
};

// 10. Create and export the model
const ServiceTicket = model<IServiceTicket>(
  "ServiceTicket",
  serviceTicketSchema
);

export default ServiceTicket;
export { generateTicketNumber };
