const express = require('express');
const c = require('../controllers/productController');
const validateId = require('../middleware/validateId');
const { requireBody, validateStockChange } = require('../middleware/validateBody');

const router = express.Router();

// Static routes MUST come before "/:id" or "low-stock" would be treated as an ID.
router.get('/low-stock', c.getLowStock);
router.get('/summary', c.getSummary);

router.route('/').get(c.getProducts).post(requireBody, c.createProduct);

router.patch('/:id/stock', validateId, validateStockChange, c.adjustStock);

router
  .route('/:id')
  .get(validateId, c.getProductById)
  .put(validateId, requireBody, c.updateProduct)
  .delete(validateId, c.deleteProduct);

module.exports = router;
