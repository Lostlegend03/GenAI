const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../models/User');
const Customer = require('../models/Customer');
const Purchase = require('../models/Purchase');

// Sample data
const sampleUsers = [
  {
    name: 'Ritesh Rajapati',
    email: 'ritesh@shop.com',
    password: 'password123',
    shopName: 'Ritesh Electronics Store',
    shopAddress: '123 Main Street, Mumbai, Maharashtra',
    phone: '+91-9876543210',
    role: 'owner'
  }
];

const sampleCustomers = [
  {
    name: 'Priya Sharma',
    email: 'priya.sharma@email.com',
    phone: '+91-9876543211',
    address: {
      street: '45 Park Avenue',
      city: 'Mumbai',
      state: 'Maharashtra',
      zipCode: '400001',
      country: 'India'
    }
  },
  {
    name: 'Amit Kumar',
    email: 'amit.kumar@email.com', 
    phone: '+91-9876543212',
    address: {
      street: '78 Gandhi Road',
      city: 'Mumbai',
      state: 'Maharashtra', 
      zipCode: '400002',
      country: 'India'
    }
  },
  {
    name: 'Sneha Patel',
    email: 'sneha.patel@email.com',
    phone: '+91-9876543213',
    address: {
      street: '12 Commercial Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      zipCode: '400003', 
      country: 'India'
    }
  },
  {
    name: 'Rajesh Gupta',
    email: 'rajesh.gupta@email.com',
    phone: '+91-9876543214',
    address: {
      street: '56 Market Road',
      city: 'Mumbai', 
      state: 'Maharashtra',
      zipCode: '400004',
      country: 'India'
    }
  },
  {
    name: 'Anita Singh',
    email: 'anita.singh@email.com',
    phone: '+91-9876543215',
    address: {
      street: '89 Station Road',
      city: 'Mumbai',
      state: 'Maharashtra',
      zipCode: '400005',
      country: 'India'
    }
  }
];

// Function to generate sample purchases
const generateSamplePurchases = (customers, userId) => {
  const purchases = [];
  const products = [
    { name: 'LED TV 43"', price: 35000 },
    { name: 'Smartphone', price: 15000 },
    { name: 'Laptop', price: 45000 },
    { name: 'Washing Machine', price: 25000 },
    { name: 'Refrigerator', price: 30000 },
    { name: 'Air Conditioner', price: 40000 },
    { name: 'Microwave Oven', price: 12000 },
    { name: 'Headphones', price: 2000 },
    { name: 'Tablet', price: 20000 },
    { name: 'Smart Watch', price: 8000 }
  ];

  customers.forEach((customer, index) => {
    // Generate 2-4 purchases per customer
    const numPurchases = Math.floor(Math.random() * 3) + 2;
    
    for (let i = 0; i < numPurchases; i++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const quantity = Math.floor(Math.random() * 2) + 1;
      const daysAgo = Math.floor(Math.random() * 30) + 1;
      const purchaseDate = new Date();
      purchaseDate.setDate(purchaseDate.getDate() - daysAgo);
      
      const totalAmount = product.price * quantity;
      const paidAmount = Math.random() > 0.3 ? totalAmount : Math.floor(totalAmount * 0.5);
      const remainingAmount = totalAmount - paidAmount;
      
      // Set due date for unpaid amounts
      let dueDate = null;
      let paymentStatus = 'completed';
      if (remainingAmount > 0) {
        dueDate = new Date(purchaseDate);
        dueDate.setDate(dueDate.getDate() + 30);
        paymentStatus = new Date() > dueDate ? 'overdue' : 'pending';
      }
      
      purchases.push({
        customer: customer._id,
        items: [{
          productName: product.name,
          quantity: quantity,
          unitPrice: product.price,
          totalPrice: totalAmount
        }],
        totalAmount: totalAmount,
        paidAmount: paidAmount,
        remainingAmount: remainingAmount,
        paymentStatus: paymentStatus,
        paymentMethod: ['cash', 'card', 'upi', 'bank_transfer'][Math.floor(Math.random() * 4)],
        purchaseDate: purchaseDate,
        dueDate: dueDate,
        createdBy: userId,
        notes: i === 0 ? 'First purchase - customer seems interested in electronics' : ''
      });
    }
  });
  
  return purchases;
};

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Seed data function
const seedData = async () => {
  try {
    console.log('🌱 Starting data seeding...');
    
    // Clear existing data
    await User.deleteMany({});
    await Customer.deleteMany({});
    await Purchase.deleteMany({});
    console.log('🗑️ Cleared existing data');
    
    // Create users
    const users = [];
    for (const userData of sampleUsers) {
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      const user = new User({
        ...userData,
        password: hashedPassword
      });
      users.push(user);
    }
    
    const createdUsers = await User.insertMany(users);
    console.log(`👤 Created ${createdUsers.length} users`);
    
    const mainUser = createdUsers[0]; // Use first user for all sample data
    
    // Create customers
    const customersData = sampleCustomers.map(customerData => ({
      ...customerData,
      createdBy: mainUser._id
    }));
    
    const createdCustomers = await Customer.insertMany(customersData);
    console.log(`👥 Created ${createdCustomers.length} customers`);
    
    // Generate and create purchases
    const purchasesData = generateSamplePurchases(createdCustomers, mainUser._id);
    const createdPurchases = await Purchase.insertMany(purchasesData);
    console.log(`🛒 Created ${createdPurchases.length} purchases`);
    
    // Update customer statistics
    console.log('📊 Updating customer statistics...');
    for (const customer of createdCustomers) {
      await customer.updatePurchaseStats();
    }
    
    console.log('✅ Data seeding completed successfully!');
    console.log('\\n📝 Login Credentials:');
    console.log('Email: ritesh@shop.com');
    console.log('Password: password123');
    console.log('\\n🚀 You can now start the server with: npm run dev');
    
  } catch (error) {
    console.error('❌ Error seeding data:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run seeder
const runSeeder = async () => {
  await connectDB();
  await seedData();
};

// Check if file is being run directly
if (require.main === module) {
  runSeeder();
}

module.exports = { seedData, runSeeder };
