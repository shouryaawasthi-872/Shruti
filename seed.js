// Optional: node seed.js  -> loads sample data so the list/summary/low-stock endpoints have something to show.
// WARNING: this deletes every existing product. It refuses to run in production without --force.
require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
  console.error('Refusing to wipe the production database. Re-run with --force if you are sure.');
  process.exit(1);
}

const data = [
  { name: 'Study Table', sku: 'FURN-TB-812', category: 'Furniture', price: 3999, quantity: 2, reorderLevel: 4, supplier: 'IKEA India' },
  { name: 'Office Chair', sku: 'FURN-CH-101', category: 'Furniture', price: 5499, quantity: 15, reorderLevel: 5, supplier: 'IKEA India' },
  { name: 'Laptop 15"', sku: 'ELEC-LP-001', category: 'Electronics', price: 52000, quantity: 5, reorderLevel: 5, supplier: 'Dell' },
  { name: 'Wireless Mouse', sku: 'ELEC-MS-002', category: 'Electronics', price: 799, quantity: 50, reorderLevel: 10, supplier: 'Logitech' },
  { name: 'Bluetooth Speaker', sku: 'ELEC-SP-003', category: 'Electronics', price: 2499, quantity: 30, reorderLevel: 8, supplier: 'boAt' },
  { name: 'Smartphone', sku: 'ELEC-PH-004', category: 'Electronics', price: 18999, quantity: 11, reorderLevel: 6, supplier: 'Samsung' },
  { name: 'Cotton T-Shirt', sku: 'APRL-TS-201', category: 'Apparel', price: 499, quantity: 60, reorderLevel: 20, supplier: 'Allen Solly' },
  { name: 'Denim Jeans', sku: 'APRL-JN-202', category: 'Apparel', price: 2299, quantity: 18, reorderLevel: 10, supplier: 'Levis' },
  { name: 'Notebook A4', sku: 'STNY-NB-701', category: 'Stationery', price: 60, quantity: 8, reorderLevel: 25, supplier: 'Classmate' },
  { name: 'Gel Pen Pack of 15', sku: 'STNY-PN-713', category: 'Stationery', price: 120, quantity: 40, reorderLevel: 20, supplier: 'Cello Pens' },
  { name: 'Basmati Rice 5kg', sku: 'GROC-RC-301', category: 'Grocery', price: 650, quantity: 3, reorderLevel: 10, supplier: 'India Gate' },
  { name: 'Olive Oil 1L', sku: 'GROC-OL-302', category: 'Grocery', price: 899, quantity: 22, reorderLevel: 10, supplier: 'Figaro' },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Product.deleteMany({});
  await Product.insertMany(data);
  console.log(`Seeded ${data.length} products`);
  await mongoose.disconnect();
})();
