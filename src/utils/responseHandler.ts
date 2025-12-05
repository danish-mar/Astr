import { Response } from "express";

// Standard API response structure
export interface ApiResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: any;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Success response
export const sendSuccess = (
  res: Response,
  data: any = null,
  message: string = "Success",
  statusCode: number = 200
) => {
  const response: ApiResponse = {
    success: true,
    message,
    data,
  };
  return res.status(statusCode).json(response);
};

// Error response
export const sendError = (
  res: Response,
  message: string = "An error occurred",
  statusCode: number = 500,
  error: any = null
) => {
  const response: ApiResponse = {
    success: false,
    message,
    error: process.env.NODE_ENV === "development" ? error : undefined,
  };
  return res.status(statusCode).json(response);
};

// Paginated response
export const sendPaginated = (
  res: Response,
  data: any[],
  page: number,
  limit: number,
  total: number,
  message: string = "Success"
) => {
  const response: ApiResponse = {
    success: true,
    message,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
  return res.status(200).json(response);
};
