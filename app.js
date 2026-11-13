const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const productRoutes = require('./routes/productRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : '*';

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '100kb' }));

app.get('/', (req, res) => res.json({ message: 'Inventory API running' }));

// Used by the demo/mobile clients and by process managers to check readiness.
app.get('/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'degraded',
    db: connected ? 'connected' : 'disconnected',
  });
});

app.use('/api/products', productRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
