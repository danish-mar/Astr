import { Response } from "express";
import { Error as MongooseError } from "mongoose";

// Handle Mongoose validation errors
export const handleValidationError = (
  error: MongooseError.ValidationError,
  res: Response
) => {
  const errors: { [key: string]: string } = {};

  Object.keys(error.errors).forEach((key) => {
    errors[key] = error.errors[key].message;
  });

  return res.status(400).json({
    success: false,
    message: "Validation Error",
    errors,
  });
};

// Handle duplicate key errors (MongoDB)
export const handleDuplicateKeyError = (error: any, res: Response) => {
  const field = Object.keys(error.keyPattern)[0];
  const value = error.keyValue[field];

  return res.status(409).json({
    success: false,
    message: `${field} '${value}' already exists`,
    field,
  });
};

// Handle cast errors (invalid ObjectId)
export const handleCastError = (error: any, res: Response) => {
  return res.status(400).json({
    success: false,
    message: "Invalid ID format",
    field: error.path,
  });
};

// Generic error handler
export const handleError = (error: any, res: Response) => {
  console.error("Error:", error);

  // Mongoose validation error
  if (error.name === "ValidationError") {
    return handleValidationError(error, res);
  }

  // Duplicate key error
  if (error.code === 11000) {
    return handleDuplicateKeyError(error, res);
  }

  // Cast error (invalid ObjectId)
  if (error.name === "CastError") {
    return handleCastError(error, res);
  }

  // Default error
  return res.status(500).json({
    success: false,
    message: error.message || "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? error : undefined,
  });
};
