import mongoose from "mongoose";
import dotenv from "dotenv";
import readline from "readline";
import Employee from "../models/Employee";
import connectDB from "../config/database";

dotenv.config();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Promisify readline question
const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

const createAdmin = async () => {
  try {
    console.log("\n🔐 Admin User Creation Script\n");
    console.log("=".repeat(50));

    // Connect to database
    await connectDB();

    // Get admin details from user
    const username = await question("Enter admin username: ");

    if (!username || username.trim().length < 3) {
      console.log("❌ Username must be at least 3 characters long");
      process.exit(1);
    }

    // Check if username already exists
    const existingUser = await Employee.findOne({
      username: username.toLowerCase(),
    });
    if (existingUser) {
      console.log("❌ Username already exists!");
      const overwrite = await question(
        "Do you want to delete the existing user and create new? (yes/no): "
      );

      if (overwrite.toLowerCase() !== "yes") {
        console.log("❌ Admin creation cancelled");
        process.exit(0);
      }

      await Employee.findByIdAndDelete(existingUser._id);
      console.log("✅ Existing user deleted");
    }

    const name = await question("Enter admin name: ");

    if (!name || name.trim().length < 2) {
      console.log("❌ Name must be at least 2 characters long");
      process.exit(1);
    }

    const password = await question(
      "Enter admin password (min 6 characters): "
    );

    if (!password || password.length < 6) {
      console.log("❌ Password must be at least 6 characters long");
      process.exit(1);
    }

    const email = await question(
      "Enter admin email (optional, press enter to skip): "
    );
    const phone = await question(
      "Enter admin phone (optional, press enter to skip): "
    );

    console.log("\n📝 Creating admin user...");

    // Create admin user
    const admin = new Employee({
      username: username.toLowerCase().trim(),
      password,
      name: name.trim(),
      position: "Admin",
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      isActive: true,
    });

    await admin.save();

    console.log("\n✅ Admin user created successfully!\n");
    console.log("=".repeat(50));
    console.log("📋 Admin Details:");
    console.log(`   Username: ${admin.username}`);
    console.log(`   Name: ${admin.name}`);
    console.log(`   Position: ${admin.position}`);
    if (admin.email) console.log(`   Email: ${admin.email}`);
    if (admin.phone) console.log(`   Phone: ${admin.phone}`);
    console.log("=".repeat(50));
    console.log("\n🔐 Login Credentials:");
    console.log(`   Username: ${admin.username}`);
    console.log(`   Password: ${password}`);
    console.log("\n⚠️  Please save these credentials securely!\n");

    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Error creating admin:", error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
};

// Run if executed directly
if (require.main === module) {
  createAdmin();
}

export default createAdmin;
