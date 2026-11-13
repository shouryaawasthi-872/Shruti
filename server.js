require('dotenv').config();
const app = require('./app');
const { connectDB, disconnectDB } = require('./config/db');

const PORT = Number(process.env.PORT) || 5000;

(async () => {
  try {
    await connectDB();
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Close the HTTP server and the DB handle instead of dropping connections.
  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
})();
