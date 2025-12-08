import { Request, Response } from "express";
import Product from "../models/Product";
import { sendSuccess, sendError, sendPaginated, handleError } from "../utils";
import { validateRequiredFields, isValidObjectId } from "../utils";
import { generateUniqueProductID } from "../utils";

// Get all products with filtering and pagination
export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const {
      category,
      source,
      isSold,
      search,
      page = 1,
      limit = 10,
      tags,
    } = req.query;

    const filter: any = {};

    // Filter by category
    if (category && isValidObjectId(category as string)) {
      filter.category = category;
    }

    // Filter by source
    if (source && isValidObjectId(source as string)) {
      filter.source = source;
    }

    // Filter by sold status
    if (isSold !== undefined) {
      filter.isSold = isSold === "true";
    }

    // Filter by tags
    if (tags) {
      filter.tags = { $in: (tags as string).split(",") };
    }

    // Search by name or productID
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { productID: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const products = await Product.find(filter)
      .populate("category", "name")
      .populate("source", "name contactType")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Product.countDocuments(filter);

    return sendPaginated(
      res,
      products,
      pageNum,
      limitNum,
      total,
      "Products retrieved successfully"
    );
  } catch (error) {
    return handleError(error, res);
  }
};

// Get single product by ID
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid product ID", 400);
    }

    const product = await Product.findById(id)
      .populate("category")
      .populate("source");

    if (!product) {
      return sendError(res, "Product not found", 404);
    }

    return sendSuccess(res, product, "Product retrieved successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Get product by Product ID (6-char code)
export const getProductByProductID = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    const product = await Product.findOne({
      productID: productId.toUpperCase(),
    })
      .populate("category")
      .populate("source");

    if (!product) {
      return sendError(res, "Product not found", 404);
    }

    return sendSuccess(res, product, "Product retrieved successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Create new product
export const createProduct = async (req: Request, res: Response) => {
  try {
    const {
      name,
      category,
      source,
      specifications,
      tags,
      notes,
      assignProductID,
      price,
    } = req.body;

    // Validate required fields
    const missing = validateRequiredFields(req.body, [
      "name",
      "category",
      "source",
    ]);
    if (missing.length > 0) {
      return sendError(
        res,
        `Missing required fields: ${missing.join(", ")}`,
        400
      );
    }

    // Validate category and source IDs
    if (!isValidObjectId(category)) {
      return sendError(res, "Invalid category ID", 400);
    }

    if (!isValidObjectId(source)) {
      return sendError(res, "Invalid source ID", 400);
    }

    // Create product
    const product = new Product({
      name,
      category,
      source,
      specifications: specifications || {},
      tags: tags || [],
      notes,
      price: price || 0,
    });

    // Assign product ID if requested
    if (assignProductID === true || assignProductID === "true") {
      product.productID = await generateUniqueProductID();
    }

    await product.save();

    // Populate before sending response
    await product.populate("category source");

    return sendSuccess(res, product, "Product created successfully", 201);
  } catch (error) {
    return handleError(error, res);
  }
};

// Update product
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, category, source, specifications, tags, notes, isSold, price } =
      req.body;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid product ID", 400);
    }

    const product = await Product.findById(id);

    if (!product) {
      return sendError(res, "Product not found", 404);
    }

    // Update fields
    if (name) product.name = name;
    if (category && isValidObjectId(category)) product.category = category;
    if (source && isValidObjectId(source)) product.source = source;
    if (specifications) product.specifications = specifications;
    if (tags) product.tags = tags;
    if (notes !== undefined) product.notes = notes;
    if (isSold !== undefined) product.isSold = isSold;
    if (price !== undefined) product.price = price;

    await product.save();
    await product.populate("category source");

    return sendSuccess(res, product, "Product updated successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Delete product
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid product ID", 400);
    }

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return sendError(res, "Product not found", 404);
    }

    return sendSuccess(res, null, "Product deleted successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Assign Product ID to existing product
export const assignProductIDToProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid product ID", 400);
    }

    const product = await Product.findById(id);

    if (!product) {
      return sendError(res, "Product not found", 404);
    }

    if (product.productID) {
      return sendError(res, "Product already has a Product ID assigned", 409);
    }

    product.productID = await generateUniqueProductID();
    await product.save();

    return sendSuccess(res, product, "Product ID assigned successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Mark product as sold
export const markProductAsSold = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid product ID", 400);
    }

    const product = await Product.findById(id);

    if (!product) {
      return sendError(res, "Product not found", 404);
    }

    if (product.isSold) {
      return sendError(res, "Product is already marked as sold", 409);
    }

    product.isSold = true;
    product.soldDate = new Date();
    await product.save();

    return sendSuccess(res, product, "Product marked as sold successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Get product statistics
export const getProductStats = async (req: Request, res: Response) => {
  try {
    const total = await Product.countDocuments();
    const sold = await Product.countDocuments({ isSold: true });
    const available = await Product.countDocuments({ isSold: false });

    const byCategory = await Product.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: "$category",
      },
      {
        $project: {
          categoryName: "$category.name",
          count: 1,
        },
      },
    ]);

    const result = {
      total,
      sold,
      available,
      byCategory,
    };

    return sendSuccess(
      res,
      result,
      "Product statistics retrieved successfully"
    );
  } catch (error) {
    return handleError(error, res);
  }
};
