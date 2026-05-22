import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGO_URI || 'mongodb://localhost:27017/vikrampresence',
      { serverSelectionTimeoutMS: 5000 }
    );
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error: any) {
    // Non-fatal: log warning but don't crash the server.
    // Admin login, quotes, reviews, products, orders all run on Supabase.
    // Only User auth (register/login/OTP) and Newsletter require MongoDB.
    console.warn(`⚠️  MongoDB unavailable: ${error.message}`);
    console.warn('   → Auth routes requiring User model will fail until MongoDB is running.');
    console.warn('   → All Supabase-based routes (admin, quotes, reviews, products) remain operational.');
  }
};

export default connectDB;
