import { Request, Response } from "express";
import Category from "../models/Category";
import Product from "../models/Product";
import { sendSuccess, sendError, handleError } from "../utils";
import { validateRequiredFields, isValidObjectId } from "../utils";

// Get all categories
export const getAllCategories = async (req: Request, res: Response) => {
  try {
    const categories = await Category.find().sort({ name: 1 });

    return sendSuccess(res, categories, "Categories retrieved successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Get single category by ID
export const getCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid category ID", 400);
    }

    const category = await Category.findById(id);

    if (!category) {
      return sendError(res, "Category not found", 404);
    }

    return sendSuccess(res, category, "Category retrieved successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Create new category
export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, description, specificationsTemplate } = req.body;

    // Validate required fields
    const missing = validateRequiredFields(req.body, ["name"]);
    if (missing.length > 0) {
      return sendError(
        res,
        `Missing required fields: ${missing.join(", ")}`,
        400
      );
    }

    // Create category
    const category = new Category({
      name,
      description,
      specificationsTemplate: specificationsTemplate || [],
    });

    await category.save();

    return sendSuccess(res, category, "Category created successfully", 201);
  } catch (error) {
    return handleError(error, res);
  }
};

// Update category
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, specificationsTemplate } = req.body;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid category ID", 400);
    }

    const category = await Category.findById(id);

    if (!category) {
      return sendError(res, "Category not found", 404);
    }

    // Update fields
    if (name) category.name = name;
    if (description !== undefined) category.description = description;
    if (specificationsTemplate)
      category.specificationsTemplate = specificationsTemplate;

    await category.save();

    return sendSuccess(res, category, "Category updated successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Delete category
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid category ID", 400);
    }

    // Check if any products use this category
    const productsCount = await Product.countDocuments({ category: id });

    if (productsCount > 0) {
      return sendError(
        res,
        `Cannot delete category. ${productsCount} product(s) are using this category`,
        409
      );
    }

    const category = await Category.findByIdAndDelete(id);

    if (!category) {
      return sendError(res, "Category not found", 404);
    }

    return sendSuccess(res, null, "Category deleted successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Get category with product count
export const getCategoriesWithCount = async (req: Request, res: Response) => {
  try {
    const categories = await Category.aggregate([
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "category",
          as: "products",
        },
      },
      {
        $project: {
          name: 1,
          description: 1,
          specificationsTemplate: 1,
          productCount: { $size: "$products" },
          createdAt: 1,
          updatedAt: 1,
        },
      },
      {
        $sort: { name: 1 },
      },
    ]);

    return sendSuccess(
      res,
      categories,
      "Categories with product count retrieved successfully"
    );
  } catch (error) {
    return handleError(error, res);
  }
};

// Get specification template for a category
export const getCategoryTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, "Invalid category ID", 400);
    }

    const category = await Category.findById(id).select(
      "specificationsTemplate"
    );

    if (!category) {
      return sendError(res, "Category not found", 404);
    }

    return sendSuccess(
      res,
      category.specificationsTemplate,
      "Specification template retrieved successfully"
    );
  } catch (error) {
    return handleError(error, res);
  }
};
