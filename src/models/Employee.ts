import mongoose, { Schema, model, Document, Types, Model } from "mongoose";
import bcrypt from "bcrypt";

// 1. Define TypeScript interface for Employee document
export interface IEmployee extends Document {
  _id: Types.ObjectId;
  username: string;
  password: string;
  name: string;
  position: "Admin" | "CEO" | "Technician" | "Sales" | "Manager" | "Staff";
  email?: string;
  phone?: string;
  isActive: boolean;
  status: "Active" | "Resigned" | "Suspended";
  group?: string;
  accountId?: mongoose.Types.ObjectId;
  permissions: string[];
  salaryConfig: {
    type: 'daily' | 'monthly';
    amount: number;
  };
  personalInfo?: {
    email?: string;
    phone?: string;
    address?: string;
    joiningDate?: Date;
  };
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// Define interface for Employee Model with static methods
interface IEmployeeModel extends Model<IEmployee> {
  authenticate(username: string, password: string): Promise<any>;
  findByPosition(position: string): Promise<IEmployee[]>;
}

// 2. Create the Mongoose schema
const employeeSchema = new Schema<IEmployee, IEmployeeModel>(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, "Username must be at least 3 characters long"],
      maxlength: [30, "Username cannot exceed 30 characters"],
      validate: {
        validator: function (v: string) {
          // Allow only alphanumeric and underscore
          return /^[a-z0-9_]+$/.test(v);
        },
        message:
          "Username can only contain lowercase letters, numbers, and underscores",
      },
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
      select: false, // Don't return password by default in queries
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters long"],
    },
    position: {
      type: String,
      required: [true, "Position is required"],
      enum: {
        values: ["Admin", "CEO", "Technician", "Sales", "Manager", "Staff"],
        message: "{VALUE} is not a valid position",
      },
      default: "Staff",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true, // Allows multiple null values but unique non-null values
      validate: {
        validator: function (v: string) {
          if (!v) return true;
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: "Please enter a valid email address",
      },
    },
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: function (v: string) {
          if (!v) return true;
          return /^[0-9]{10}$/.test(v);
        },
        message: "Please enter a valid 10-digit phone number",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["Active", "Resigned", "Suspended"],
      default: "Active",
    },
    group: {
      type: String,
      default: "General",
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
    },
    permissions: {
      type: [String],
      default: [],
    },
    salaryConfig: {
      type: {
        type: String,
        enum: ['daily', 'monthly'],
        default: 'monthly',
      },
      amount: {
        type: Number,
        default: 0,
      },
    },
    personalInfo: {
      email: String,
      phone: String,
      address: String,
      joiningDate: {
        type: Date,
        default: Date.now,
      },
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// 4. Add indexes for better query performance
// username and email are already indexed by unique: true
employeeSchema.index({ position: 1 });
employeeSchema.index({ isActive: 1 });

// 4. Pre-save hook to hash password before saving
employeeSchema.pre("save", async function () {
  const employee = this;

  // Only hash the password if it has been modified (or is new)
  if (!employee.isModified("password")) {
    return;
  }

  // Generate salt and hash password
  const salt = await bcrypt.genSalt(10);
  employee.password = await bcrypt.hash(employee.password, salt);
});

// 5. Instance method to compare password for login
employeeSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

// 6. Instance method to update last login
employeeSchema.methods.updateLastLogin = async function () {
  this.lastLogin = new Date();
  await this.save();
};

// 7. Static method to find active employees by position
employeeSchema.statics.findByPosition = function (position: string) {
  return this.find({ position, isActive: true });
};

// 8. Static method to authenticate user
employeeSchema.statics.authenticate = async function (
  username: string,
  password: string
) {
  // Find user and explicitly select password field
  const employee = await this.findOne({ username, isActive: true }).select(
    "+password"
  );

  if (!employee) {
    return null;
  }

  // Compare password
  const isMatch = await employee.comparePassword(password);

  if (!isMatch) {
    return null;
  }

  // Update last login
  employee.lastLogin = new Date();
  await employee.save();

  // Return employee without password
  const employeeObject = employee.toObject() as any;
  delete employeeObject.password;

  return employeeObject;
};

// 9. Don't return password in JSON responses
employeeSchema.methods.toJSON = function () {
  const employee = this.toObject();
  delete employee.password;
  return employee;
};

// 10. Create and export the model
const Employee = model<IEmployee, IEmployeeModel>("Employee", employeeSchema);

export default Employee;
