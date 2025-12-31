import mongoose, { Schema, Document } from "mongoose";

export interface IAttendance extends Document {
    employee: mongoose.Types.ObjectId;
    date: string; // YYYY-MM-DD
    checkIn?: Date;
    checkOut?: Date;
    status: "present" | "absent" | "late" | "half-day";
    location?: {
        lat: number;
        lng: number;
    };
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const attendanceSchema = new Schema<IAttendance>(
    {
        employee: {
            type: Schema.Types.ObjectId,
            ref: "Employee",
            required: true,
        },
        date: {
            type: String,
            required: true,
            index: true,
        },
        checkIn: {
            type: Date,
        },
        checkOut: {
            type: Date,
        },
        status: {
            type: String,
            enum: ["present", "absent", "late", "half-day"],
            default: "present",
        },
        location: {
            lat: Number,
            lng: Number,
        },
        notes: String,
    },
    {
        timestamps: true,
    }
);

// Composite unique index to prevent duplicate attendance per employee per day
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model<IAttendance>("Attendance", attendanceSchema);

export default Attendance;
