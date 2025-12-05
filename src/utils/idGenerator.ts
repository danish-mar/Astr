import Product from "../models/Product";
import ServiceTicket from "../models/ServiceTicket";

// Generate unique Product ID
export const generateUniqueProductID = async (): Promise<string> => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let isUnique = false;
  let productID = "";

  while (!isUnique) {
    productID = "";
    for (let i = 0; i < 6; i++) {
      productID += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const existing = await Product.findOne({ productID });
    if (!existing) {
      isUnique = true;
    }
  }

  return productID;
};

// Generate unique Ticket Number
export const generateUniqueTicketNumber = async (): Promise<string> => {
  let isUnique = false;
  let ticketNumber = "";

  while (!isUnique) {
    const min = 100000;
    const max = 999999;
    ticketNumber = Math.floor(Math.random() * (max - min + 1) + min).toString();

    const existing = await ServiceTicket.findOne({ ticketNumber });
    if (!existing) {
      isUnique = true;
    }
  }

  return ticketNumber;
};

// Generate random alphanumeric string of given length
export const generateRandomString = (length: number = 8): string => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
};
