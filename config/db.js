const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not set. Copy .env.example to .env and set MONGO_URI.');
  }

  // Fail fast (5s) instead of hanging when Mongo is not running.
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  console.log('MongoDB connected');
};

const disconnectDB = () => mongoose.connection.close();

module.exports = { connectDB, disconnectDB };
