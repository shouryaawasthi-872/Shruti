// Rejects empty/non-object bodies and bad stock-change payloads before they reach the controllers.
const requireBody = (req, res, next) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length === 0) {
    return res.status(400).json({ error: 'Request body must be a non-empty JSON object' });
  }
  next();
};

const validateStockChange = (req, res, next) => {
  const { change } = req.body || {};

  // Safe integers only: 1e20 is an "integer" but overflows Mongo's numeric handling.
  if (!Number.isSafeInteger(change) || change === 0) {
    return res
      .status(400)
      .json({ error: '"change" must be a non-zero integer (positive = restock, negative = sale)' });
  }
  next();
};

module.exports = { requireBody, validateStockChange };
