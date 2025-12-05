// Validate MongoDB ObjectId
export const isValidObjectId = (id: string): boolean => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

// Validate email
export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Validate phone number (10 digits)
export const isValidPhone = (phone: string): boolean => {
  return /^[0-9]{10}$/.test(phone);
};

// Validate product ID format (6 alphanumeric)
export const isValidProductID = (productId: string): boolean => {
  return /^[A-Z0-9]{6}$/.test(productId);
};

// Validate ticket number (6 digits)
export const isValidTicketNumber = (ticketNumber: string): boolean => {
  return /^[0-9]{6}$/.test(ticketNumber);
};

// Sanitize string input
export const sanitizeString = (str: string): string => {
  return str.trim().replace(/[<>]/g, "");
};

// Validate required fields
export const validateRequiredFields = (
  data: any,
  requiredFields: string[]
): string[] => {
  const missing: string[] = [];

  requiredFields.forEach((field) => {
    if (
      !data[field] ||
      (typeof data[field] === "string" && data[field].trim() === "")
    ) {
      missing.push(field);
    }
  });

  return missing;
};
