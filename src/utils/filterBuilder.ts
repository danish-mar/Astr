import { isValidObjectId } from "./validation";

export const buildProductFilter = (query: any) => {
    const {
        category,
        source,
        isSold,
        search,
        tags,
        specs,
        minPrice,
        maxPrice,
    } = query;

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
    if (isSold !== undefined && isSold !== null && isSold !== "") {
        filter.isSold = isSold === "true" || isSold === true;
    }

    // Filter by tags
    if (tags) {
        const tagsArray = typeof tags === "string" ? tags.split(",") : tags;
        filter.tags = { $in: tagsArray };
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

    return filter;
};
