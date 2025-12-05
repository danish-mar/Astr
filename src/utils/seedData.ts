import mongoose from "mongoose";
import dotenv from "dotenv";
import {
  Contact,
  Category,
  Product,
  ServiceTicket,
  ShopSettings,
  Employee,
} from "../models";
import connectDB from "../config/database";

dotenv.config();

// Sample data
const seedData = async () => {
  try {
    console.log("🌱 Starting database seeding...");

    // Connect to database
    await connectDB();

    // Clear existing data
    console.log("🗑️  Clearing existing data...");
    await Contact.deleteMany({});
    await Category.deleteMany({});
    await Product.deleteMany({});
    await ServiceTicket.deleteMany({});
    await Employee.deleteMany({});
    await ShopSettings.deleteMany({});

    // 1. Create Shop Settings
    console.log("⚙️  Creating shop settings...");
    const shopSettings = await ShopSettings.create({
      shopName: "Astr Computer Solutions",
      address: "123 MG Road, Bangalore, Karnataka - 560001",
      phone: "9876543210",
      email: "contact@astr.com",
    });
    console.log("✅ Shop settings created");

    // 2. Create Employees
    console.log("👥 Creating employees...");
    const employees = await Employee.create([
      {
        username: "admin",
        password: "admin123",
        name: "Rajesh Kumar",
        position: "Admin",
        email: "admin@astr.com",
        phone: "9876543210",
      },
      {
        username: "manager1",
        password: "manager123",
        name: "Priya Sharma",
        position: "Manager",
        email: "priya@astr.com",
        phone: "9876543211",
      },
      {
        username: "tech1",
        password: "tech123",
        name: "Amit Patel",
        position: "Technician",
        email: "amit@astr.com",
        phone: "9876543212",
      },
      {
        username: "sales1",
        password: "sales123",
        name: "Neha Gupta",
        position: "Sales",
        email: "neha@astr.com",
        phone: "9876543213",
      },
    ]);
    console.log(`✅ Created ${employees.length} employees`);

    // 3. Create Contacts
    console.log("📞 Creating contacts...");
    const contacts = await Contact.create([
      {
        name: "Tech Distributors Pvt Ltd",
        phone: "9988776655",
        contactType: "Vendor",
        address: "SP Road, Bangalore",
        companyName: "Tech Distributors",
      },
      {
        name: "Dell India",
        phone: "9988776656",
        contactType: "Supplier",
        companyName: "Dell Technologies",
      },
      {
        name: "Ramesh Kumar",
        phone: "9988776657",
        contactType: "Customer",
        address: "Koramangala, Bangalore",
      },
      {
        name: "Infosys Ltd",
        phone: "9988776658",
        contactType: "Customer",
        companyName: "Infosys Technologies",
        address: "Electronic City, Bangalore",
      },
      {
        name: "HP Enterprise",
        phone: "9988776659",
        contactType: "Supplier",
        companyName: "HP Inc",
      },
    ]);
    console.log(`✅ Created ${contacts.length} contacts`);

    // 4. Create Categories
    console.log("📁 Creating categories...");
    const categories = await Category.create([
      {
        name: "Laptop",
        description: "Laptop computers and notebooks",
        specificationsTemplate: [
          { fieldName: "Brand", fieldType: "text", required: true },
          { fieldName: "CPU", fieldType: "text", required: true },
          { fieldName: "RAM", fieldType: "text", required: true },
          {
            fieldName: "Storage Type",
            fieldType: "select",
            options: ["SSD", "HDD", "NVMe"],
            required: true,
          },
          { fieldName: "Storage Size", fieldType: "text", required: true },
          { fieldName: "GPU", fieldType: "text", required: false },
          { fieldName: "Screen Size", fieldType: "text", required: false },
        ],
      },
      {
        name: "Desktop",
        description: "Desktop computers",
        specificationsTemplate: [
          { fieldName: "Brand", fieldType: "text", required: true },
          { fieldName: "CPU", fieldType: "text", required: true },
          { fieldName: "RAM", fieldType: "text", required: true },
          {
            fieldName: "Storage Type",
            fieldType: "select",
            options: ["SSD", "HDD", "NVMe"],
            required: true,
          },
          { fieldName: "Storage Size", fieldType: "text", required: true },
          { fieldName: "GPU", fieldType: "text", required: false },
        ],
      },
      {
        name: "Monitor",
        description: "Display monitors",
        specificationsTemplate: [
          { fieldName: "Brand", fieldType: "text", required: true },
          { fieldName: "Screen Size", fieldType: "text", required: true },
          {
            fieldName: "Resolution",
            fieldType: "select",
            options: ["1920x1080", "2560x1440", "3840x2160"],
            required: true,
          },
          {
            fieldName: "Panel Type",
            fieldType: "select",
            options: ["IPS", "TN", "VA"],
            required: false,
          },
          { fieldName: "Refresh Rate", fieldType: "text", required: false },
        ],
      },
      {
        name: "Accessories",
        description: "Computer accessories",
        specificationsTemplate: [
          { fieldName: "Type", fieldType: "text", required: true },
          { fieldName: "Brand", fieldType: "text", required: true },
          { fieldName: "Model", fieldType: "text", required: false },
        ],
      },
    ]);
    console.log(`✅ Created ${categories.length} categories`);

    // 5. Create Products
    console.log("💻 Creating products...");
    const products = await Product.create([
      {
        productID: "LAP001",
        name: "Dell Latitude 5420",
        category: categories[0]._id,
        source: contacts[1]._id,
        specifications: {
          Brand: "Dell",
          CPU: "Intel i5 11th Gen",
          RAM: "16GB DDR4",
          "Storage Type": "SSD",
          "Storage Size": "512GB",
          "Screen Size": "14 inch",
        },
        tags: ["laptop", "dell", "corporate"],
        isSold: false,
      },
      {
        productID: "LAP002",
        name: "HP EliteBook 840",
        category: categories[0]._id,
        source: contacts[4]._id,
        specifications: {
          Brand: "HP",
          CPU: "Intel i7 11th Gen",
          RAM: "32GB DDR4",
          "Storage Type": "NVMe",
          "Storage Size": "1TB",
          GPU: "Intel Iris Xe",
          "Screen Size": "14 inch",
        },
        tags: ["laptop", "hp", "premium"],
        isSold: true,
        soldDate: new Date("2025-11-15"),
      },
      {
        productID: "DSK001",
        name: "Dell OptiPlex 7090",
        category: categories[1]._id,
        source: contacts[1]._id,
        specifications: {
          Brand: "Dell",
          CPU: "Intel i5 11th Gen",
          RAM: "16GB DDR4",
          "Storage Type": "SSD",
          "Storage Size": "512GB",
        },
        tags: ["desktop", "dell", "office"],
        isSold: false,
      },
      {
        productID: "MON001",
        name: "Dell P2422H Monitor",
        category: categories[2]._id,
        source: contacts[1]._id,
        specifications: {
          Brand: "Dell",
          "Screen Size": "24 inch",
          Resolution: "1920x1080",
          "Panel Type": "IPS",
        },
        tags: ["monitor", "dell", "24inch"],
        isSold: false,
      },
      {
        name: "Logitech MX Master 3",
        category: categories[3]._id,
        source: contacts[0]._id,
        specifications: {
          Type: "Mouse",
          Brand: "Logitech",
          Model: "MX Master 3",
        },
        tags: ["mouse", "wireless", "logitech"],
        isSold: false,
      },
    ]);
    console.log(`✅ Created ${products.length} products`);

    // 6. Create Service Tickets
    console.log("🎫 Creating service tickets...");
    const tickets = await ServiceTicket.create([
      {
        customer: contacts[2]._id,
        deviceDetails: "HP Laptop - Screen flickering issue",
        status: "In Progress",
        assignedTechnician: "Amit Patel",
        serviceCharge: 1500,
        notes: "Display cable replacement needed",
      },
      {
        customer: contacts[3]._id,
        deviceDetails: "Dell Desktop - Not booting up",
        status: "Pending",
        serviceCharge: 2000,
      },
      {
        customer: contacts[2]._id,
        deviceDetails: "Laptop Battery Replacement",
        status: "Completed",
        assignedTechnician: "Amit Patel",
        serviceCharge: 3500,
        completedAt: new Date("2025-11-20"),
      },
    ]);
    console.log(`✅ Created ${tickets.length} service tickets`);

    console.log("\n🎉 Database seeded successfully!");
    console.log("\n📊 Summary:");
    console.log(`   - Employees: ${employees.length}`);
    console.log(`   - Contacts: ${contacts.length}`);
    console.log(`   - Categories: ${categories.length}`);
    console.log(`   - Products: ${products.length}`);
    console.log(`   - Service Tickets: ${tickets.length}`);
    console.log("\n🔐 Test Credentials:");
    console.log("   Admin: username: admin, password: admin123");
    console.log("   Manager: username: manager1, password: manager123");
    console.log("   Technician: username: tech1, password: tech123");
    console.log("   Sales: username: sales1, password: sales123");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
};

// Run if executed directly
if (require.main === module) {
  seedData();
}

export default seedData;
