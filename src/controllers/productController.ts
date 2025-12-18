import { Request, Response } from "express";
import { Product, Category, Contact } from "../models";
import { sendSuccess, sendError, sendPaginated, handleError } from "../utils";
import fs from 'fs';
import csv from 'csv-parser';
// import { Parser } from 'json2csv'; // Removed to use manual generation
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
      specs,
      minPrice,
      maxPrice,
      specOps,
    } = req.query;

    const filter: any = {};

    // Filter by price range
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice as string);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice as string);
    }

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

    // Filter by specifications
    if (specs) {
      const specifications = typeof specs === "string" ? JSON.parse(specs) : specs;
      for (const [key, value] of Object.entries(specifications)) {
        if (value) {
          if (Array.isArray(value)) {
            filter[`specifications.${key}`] = { $in: value };
          } else {
            filter[`specifications.${key}`] = value;
          }
        }
      }
    }

    // Search by name, productID, or specifications
    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      filter.$or = [
        { name: searchRegex },
        { productID: searchRegex },
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
// Get dynamic filters based on available products
export const getFilters = async (req: Request, res: Response) => {
  try {
    const { category, search } = req.query;
    const match: any = {};

    // Apply basic filters to narrow down the aggregation context
    if (category && isValidObjectId(category as string)) {
      match.category = category; // Already an ObjectId in match if we use mongoose parsing, but here we might need to cast if doing raw aggregation
    }

    if (search) {
      match.$or = [
        { name: { $regex: search, $options: "i" } },
        { productID: { $regex: search, $options: "i" } },
      ];
    }

    // Find all products matching the criteria
    const products = await Product.find(match).select("specifications");

    // Aggregate unique values for each specification key
    const filters: Record<string, Set<string>> = {};

    products.forEach((product) => {
      if (product.specifications) {
        // specifications is a Map or Object, in Mongoose it comes out as an object usually if strict:false or mixed
        // But our model says Map<string, any>. Mongoose Maps need .get() sometimes but if lean() or JSON it is object.
        // Let's assume it behaves like an object for iteration if we use .toJSON() or standard access.
        // Safest is to treat it as object.
        const specs = product.specifications instanceof Map ? Object.fromEntries(product.specifications) : product.specifications;

        if (specs) {
          Object.entries(specs).forEach(([key, value]) => {
            // We only want to filter by string values that are categorical
            // Skip large text blobs or non-primitive/non-string values if necessary
            // For now, allow strings and numbers.
            if (typeof value === 'string' || typeof value === 'number') {
              if (!filters[key]) {
                filters[key] = new Set();
              }
              filters[key].add(String(value));
            }
          });
        }
      }
    });

    // Convert Sets to Arrays
    const result: Record<string, string[]> = {};
    Object.keys(filters).forEach(key => {
      result[key] = Array.from(filters[key]).sort();
    });

    return sendSuccess(res, result, "Filters retrieved successfully");
  } catch (error) {
    return handleError(error, res);
  }
};

// Export Products to CSV (or Template)
export const exportProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, template } = req.query;
    const isTemplate = template === 'true';

    let products: any[] = [];
    let headers: string[] = ["ID", "Name", "Category", "Source", "Price", "Stock", "Status"];

    if (isTemplate) {
      // For template, we want the headers for a specific category's specs
      if (category && isValidObjectId(category as string)) {
        const cat = await Category.findById(category);
        if (cat && cat.specificationsTemplate) {
          cat.specificationsTemplate.forEach((field: any) => {
            headers.push(`Spec: ${field.fieldName}`);
          });
        }
      }
    } else {
      // Normal export
      const match: any = {};
      if (category && isValidObjectId(category as string)) {
        match.category = category;
      }

      products = await Product.find(match).populate('category').populate('source');

      // Collect all unique spec keys to build headers
      const specKeys = new Set<string>();
      products.forEach(p => {
        const specs = p.specifications || {};
        if (specs instanceof Map) {
          specs.forEach((_, key) => specKeys.add(key));
        } else {
          Object.keys(specs).forEach(key => specKeys.add(key));
        }
      });

      specKeys.forEach(key => headers.push(`Spec: ${key}`));
    }

    const data = products.map((p: any) => {
      const specs = p.specifications || {};
      const row: any = {
        ID: p._id.toString(),
        Name: p.name,
        Category: p.category?.name || '',
        Source: p.source?.name || '',
        Price: p.price,
        Stock: p.stock || 0,
        Status: p.isSold ? 'Sold' : 'Available',
      };

      // Add all specs defined in headers
      headers.forEach(h => {
        if (h.startsWith('Spec: ')) {
          const specName = h.replace('Spec: ', '');
          let val = '';
          if (specs instanceof Map) {
            val = specs.get(specName) || '';
          } else {
            val = specs[specName] || '';
          }
          row[h] = val;
        }
      });

      return row;
    });

    // Manual CSV Generation
    const escapeCsvField = (field: any): string => {
      if (field === null || field === undefined) return '';
      const stringField = String(field);
      if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
        return `"${stringField.replace(/"/g, '""')}"`;
      }
      return stringField;
    };

    // Build Header Row
    let csvContent = headers.map(escapeCsvField).join(',') + '\n';

    // Build Data Rows
    if (!isTemplate || data.length > 0) {
      data.forEach(row => {
        const rowStr = headers.map(header => escapeCsvField(row[header])).join(',');
        csvContent += rowStr + '\n';
      });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${isTemplate ? 'product_template.csv' : 'products.csv'}"`);
    res.status(200).send(csvContent);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: "Error exporting products", error });
  }
};

// Preview CSV Import - Validate and return summary
export const previewImport = async (req: Request, res: Response): Promise<void> => {
  console.log('DEBUG: previewImport controller reached');

  const file = req.file;
  if (!file) {
    console.error('DEBUG: No file in req.file');
    res.status(400).json({ message: "No file uploaded" });
    return;
  }

  const results: any[] = [];

  fs.createReadStream(file.path)
    .pipe(csv())
    .on('data', (data: any) => results.push(data))
    .on('end', async () => {
      try {
        const preview = {
          totalRows: results.length,
          validRows: 0,
          invalidRows: [] as any[],
          missingCategories: new Set<string>(),
          missingSources: new Set<string>(),
          categoryMatches: {} as Record<string, string>, // CSV name -> DB ID
          sourceMatches: {} as Record<string, string>, // CSV name -> DB ID
        };

        // Get all existing categories and sources
        const existingCategories = await Category.find({});
        const existingContacts = await Contact.find({});

        for (let i = 0; i < results.length; i++) {
          const row = results[i];
          const rowErrors: string[] = [];

          // Validate required fields
          if (!row.Name || !row.Name.trim()) {
            rowErrors.push('Name is required');
          }
          if (!row.Category || !row.Category.trim()) {
            rowErrors.push('Category is required');
          }
          if (!row.Source || !row.Source.trim()) {
            rowErrors.push('Source is required');
          }

          // Try to match category
          if (row.Category) {
            const categoryMatch = existingCategories.find(
              c => c.name.toLowerCase() === row.Category.trim().toLowerCase()
            );
            if (categoryMatch) {
              preview.categoryMatches[row.Category] = categoryMatch._id.toString();
            } else {
              preview.missingCategories.add(row.Category);
            }
          }

          // Try to match source
          if (row.Source) {
            const sourceMatch = existingContacts.find(
              c => c.name.toLowerCase() === row.Source.trim().toLowerCase()
            );
            if (sourceMatch) {
              preview.sourceMatches[row.Source] = sourceMatch._id.toString();
            } else {
              preview.missingSources.add(row.Source);
            }
          }

          if (rowErrors.length > 0) {
            preview.invalidRows.push({
              rowNumber: i + 1,
              name: row.Name || 'Unknown',
              errors: rowErrors
            });
          } else {
            preview.validRows++;
          }
        }

        // Clean up file
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

        // Convert Sets to Arrays for JSON response
        res.status(200).json({
          totalRows: preview.totalRows,
          validRows: preview.validRows,
          invalidRows: preview.invalidRows,
          missingCategories: Array.from(preview.missingCategories),
          missingSources: Array.from(preview.missingSources),
          categoryMatches: preview.categoryMatches,
          sourceMatches: preview.sourceMatches,
        });

      } catch (error) {
        console.error('Preview error:', error);
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        res.status(500).json({ message: "Error previewing CSV", error });
      }
    })
    .on('error', (error: any) => {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      res.status(500).json({ message: "Error reading file", error });
    });
};

// Import Products from CSV
export const importProducts = async (req: Request, res: Response): Promise<void> => {
  console.log('DEBUG: importProducts controller reached');
  console.log('DEBUG: req.file:', req.file);
  console.log('DEBUG: req.body:', req.body);
  console.log('DEBUG: req.headers content-type:', req.headers['content-type']);

  const file = req.file;
  if (!file) {
    console.error('DEBUG: No file in req.file');
    res.status(400).json({ message: "No file uploaded" });
    return;
  }

  const results: any[] = [];

  fs.createReadStream(file.path)
    .pipe(csv())
    .on('data', (data: any) => results.push(data))
    .on('end', async () => {
      try {
        let importedCount = 0;
        const errors: string[] = [];

        for (const row of results) {
          try {
            // Find Category
            let categoryId;
            if (row.Category) {
              const cat = await Category.findOne({ name: new RegExp('^' + row.Category + '$', 'i') });
              if (cat) categoryId = cat._id;
            }

            // Find Source (Contact)
            let sourceId;
            if (row.Source) {
              const source = await Contact.findOne({ name: new RegExp('^' + row.Source + '$', 'i') });
              if (source) sourceId = source._id;
            }
            // If explicit Source not found, maybe try a default or fail?
            // Validation will fail if sourceId is undefined.

            // Auto-create/Fallback logic could go here if requested, but for now we'll let validation catch it if missing.

            // Parse Specs
            const specifications: any = {};
            Object.keys(row).forEach(key => {
              if (key.startsWith('Spec: ')) {
                const specName = key.replace('Spec: ', '').trim();
                if (row[key]) specifications[specName] = row[key];
              }
            });

            // Parse common fields
            const productData = {
              name: row.Name,
              price: parseFloat(row.Price) || 0,
              stock: parseInt(row.Stock) || 0,
              isSold: row.Status === 'Sold',
              category: categoryId,
              source: sourceId,
              specifications: specifications
            };

            await Product.create(productData);
            importedCount++;
          } catch (rowError: any) {
            errors.push(`Row "${row.Name}": ${rowError.message}`);
          }
        }

        // Clean up
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

        res.json({
          message: `Imported ${importedCount} products`,
          errors: errors.length > 0 ? errors : undefined
        });

      } catch (error) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        res.status(500).json({ message: "Error processing CSV", error });
      }
    })
    .on('error', (error: any) => {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      res.status(500).json({ message: "Error reading file", error });
    });
};
