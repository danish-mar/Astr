
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/astr-db')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Could not connect to MongoDB', err));

const productSchema = new mongoose.Schema({
    name: String,
    price: Number,
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    specifications: Object,
    description: String,
    stock: Number,
    isSold: { type: Boolean, default: false },
    images: [String],
    createdAt: { type: Date, default: Date.now }
});

const categorySchema = new mongoose.Schema({
    name: String,
    specificationsTemplate: Array
});

const Product = mongoose.model('Product', productSchema);
const Category = mongoose.model('Category', categorySchema);

async function seed() {
    try {
        console.log('Seeding data...');
        
        // precise category fetching
        const laptopCat = await Category.findOne({ name: 'Laptops' });
        const phoneCat = await Category.findOne({ name: 'Smartphones' });
        
        if (!laptopCat || !phoneCat) {
            console.error('Categories not found. Please run browser verification first.');
            process.exit(1);
        }

        const products = [
             // Laptops
            { name: 'MacBook Pro 14', price: 1999, category: laptopCat._id, specifications: { 'Processor': 'Apple M1 Pro', 'RAM': '16GB' } },
            { name: 'MacBook Air M2', price: 1199, category: laptopCat._id, specifications: { 'Processor': 'Apple M2', 'RAM': '8GB' } },
            { name: 'Dell XPS 15', price: 1899, category: laptopCat._id, specifications: { 'Processor': 'Intel i7', 'RAM': '32GB' } },
            { name: 'Lenovo ThinkPad X1', price: 1499, category: laptopCat._id, specifications: { 'Processor': 'Intel i5', 'RAM': '16GB' } },
            { name: 'HP Spectre x360', price: 1399, category: laptopCat._id, specifications: { 'Processor': 'Intel i7', 'RAM': '16GB' } },
            { name: 'Asus ROG Zephyrus', price: 1699, category: laptopCat._id, specifications: { 'Processor': 'AMD Ryzen 9', 'RAM': '16GB' } },
            { name: 'Razer Blade 14', price: 2199, category: laptopCat._id, specifications: { 'Processor': 'AMD Ryzen 9', 'RAM': '16GB' } },
            { name: 'Acer Swift 3', price: 699, category: laptopCat._id, specifications: { 'Processor': 'Intel i5', 'RAM': '8GB' } },
            { name: 'Microsoft Surface Laptop', price: 999, category: laptopCat._id, specifications: { 'Processor': 'Intel i5', 'RAM': '8GB' } },
            { name: 'LG Gram 17', price: 1499, category: laptopCat._id, specifications: { 'Processor': 'Intel i7', 'RAM': '16GB' } },
            
            // Smartphones
            { name: 'iPhone 13 Pro', price: 999, category: phoneCat._id, specifications: { 'Brand': 'Apple', 'Storage': '128GB' } },
            { name: 'Samsung Galaxy S22', price: 799, category: phoneCat._id, specifications: { 'Brand': 'Samsung', 'Storage': '128GB' } },
            { name: 'Google Pixel 6', price: 599, category: phoneCat._id, specifications: { 'Brand': 'Google', 'Storage': '128GB' } },
            { name: 'OnePlus 10 Pro', price: 899, category: phoneCat._id, specifications: { 'Brand': 'OnePlus', 'Storage': '256GB' } },
            { name: 'Sony Xperia 1 III', price: 1199, category: phoneCat._id, specifications: { 'Brand': 'Sony', 'Storage': '256GB' } },
            { name: 'Xiaomi Mi 11', price: 749, category: phoneCat._id, specifications: { 'Brand': 'Xiaomi', 'Storage': '128GB' } },
            { name: 'Oppo Find X5', price: 999, category: phoneCat._id, specifications: { 'Brand': 'Oppo', 'Storage': '256GB' } },
            { name: 'Motorola Edge+', price: 799, category: phoneCat._id, specifications: { 'Brand': 'Motorola', 'Storage': '128GB' } },
            { name: 'Asus Zenfone 8', price: 699, category: phoneCat._id, specifications: { 'Brand': 'Asus', 'Storage': '128GB' } },
            { name: 'Realme GT 2', price: 549, category: phoneCat._id, specifications: { 'Brand': 'Realme', 'Storage': '128GB' } }
        ];

        for (const p of products) {
            await Product.create(p);
            console.log(`Created ${p.name}`);
        }

        console.log('Seeding complete!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding:', error);
        process.exit(1);
    }
}

seed();
