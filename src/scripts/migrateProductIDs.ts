import mongoose from "mongoose";
import dotenv from "dotenv";
import { Product } from "../models";
import { generateProductID } from "../models/Product";

dotenv.config();

const migrateProductIDs = async () => {
  try {
    console.log("Starting Product ID migration...");
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || "mongodb://root:rootasdf@localhost:6545/astr?authSource=admin";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB.");

    // Find products without productID or with empty/null productID
    const productsToMigrate = await Product.find({
      $or: [
        { productID: { $exists: false } },
        { productID: null },
        { productID: "" }
      ]
    });

    console.log(`Found ${productsToMigrate.length} products to migrate.`);

    let migratedCount = 0;
    for (const product of productsToMigrate) {
      let isUnique = false;
      let newID = "";

      // Keep generating until we get a unique ID
      while (!isUnique) {
        newID = generateProductID();
        const existing = await Product.findOne({ productID: newID });
        if (!existing) {
          isUnique = true;
        }
      }

      product.productID = newID;
      await product.save();
      migratedCount++;
      
      if (migratedCount % 10 === 0) {
        console.log(`Migrated ${migratedCount}/${productsToMigrate.length}...`);
      }
    }

    console.log(`Successfully migrated ${migratedCount} products.`);
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

migrateProductIDs();
