const Product = require('../models/Product');
const {
  escapeRegex,
  parseSort,
  parseNonNegativeNumber,
  parsePagination,
} = require('../utils/query');

// Only these fields can be written by the client. Everything else is either
// read-only (managed by Mongoose) or a typo, which we report instead of silently dropping.
const WRITABLE_FIELDS = [
  'name',
  'sku',
  'category',
  'price',
  'quantity',
  'reorderLevel',
  'supplier',
];
const READ_ONLY_FIELDS = ['_id', 'id', '__v', 'createdAt', 'updatedAt', 'stockValue'];

const pickWritableFields = (body) => {
  const data = {};
  for (const field of WRITABLE_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field];
  }

  const unknown = Object.keys(body).filter(
    (key) => !WRITABLE_FIELDS.includes(key) && !READ_ONLY_FIELDS.includes(key)
  );

  return { data, unknown };
};

// POST /api/products
exports.createProduct = async (req, res, next) => {
  try {
    const { data, unknown } = pickWritableFields(req.body);

    if (unknown.length) {
      return res.status(400).json({ error: `Unknown field(s): ${unknown.join(', ')}` });
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No writable fields provided' });
    }

    const product = await Product.create(data);
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
};

// GET /api/products?category=&supplier=&search=&minPrice=&maxPrice=&inStock=&sort=&page=&limit=
exports.getProducts = async (req, res, next) => {
  try {
    const { category, supplier, search, inStock } = req.query;
    const filter = {};

    if (category) filter.category = new RegExp(`^${escapeRegex(category)}$`, 'i');
    if (supplier) filter.supplier = new RegExp(escapeRegex(supplier), 'i');

    // Search name and SKU so users can paste either one into the search box.
    if (search) {
      const term = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: term }, { sku: term }];
    }

    const minPrice = parseNonNegativeNumber(req.query.minPrice, 'minPrice');
    const maxPrice = parseNonNegativeNumber(req.query.maxPrice, 'maxPrice');
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = minPrice;
      if (maxPrice !== undefined) filter.price.$lte = maxPrice;
    }

    if (inStock !== undefined) {
      if (inStock !== 'true' && inStock !== 'false') {
        return res.status(400).json({ error: 'inStock must be "true" or "false"' });
      }
      filter.quantity = inStock === 'true' ? { $gt: 0 } : 0;
    }

    const sort = parseSort(req.query.sort);
    const { page, limit } = parsePagination(req.query.page, req.query.limit);
    const skip = (page - 1) * limit;

    const [total, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter).sort(sort).skip(skip).limit(limit),
    ]);

    res.json({
      total,
      page,
      totalPages: Math.ceil(total / limit),
      count: products.length,
      products,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/products/:id
exports.getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    next(err);
  }
};

// PUT /api/products/:id
exports.updateProduct = async (req, res, next) => {
  try {
    const { data, unknown } = pickWritableFields(req.body);

    if (unknown.length) {
      return res.status(400).json({ error: `Unknown field(s): ${unknown.join(', ')}` });
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No writable fields provided' });
    }

    const product = await Product.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/products/:id/stock   body: { "change": 10 } or { "change": -3 }
// Atomic $inc; the quantity >= -change guard stops stock going negative under concurrent sales.
exports.adjustStock = async (req, res, next) => {
  try {
    const { change } = req.body;
    const filter = { _id: req.params.id };
    if (change < 0) filter.quantity = { $gte: -change };

    const product = await Product.findOneAndUpdate(
      filter,
      { $inc: { quantity: change } },
      { new: true, runValidators: true }
    );

    if (!product) {
      const exists = await Product.exists({ _id: req.params.id });
      if (!exists) return res.status(404).json({ error: 'Product not found' });
      return res.status(400).json({ error: 'Insufficient stock for this sale' });
    }

    res.json({ message: 'Stock updated', product });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/products/:id
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted', id: product.id });
  } catch (err) {
    next(err);
  }
};

// GET /api/products/low-stock  -> quantity <= reorderLevel
exports.getLowStock = async (req, res, next) => {
  try {
    const lowStockItems = await Product.find({
      $expr: { $lte: ['$quantity', '$reorderLevel'] },
    }).sort({ quantity: 1 });

    res.json({ count: lowStockItems.length, lowStockItems });
  } catch (err) {
    next(err);
  }
};

// GET /api/products/summary  -> category-wise aggregation
exports.getSummary = async (req, res, next) => {
  try {
    const summary = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalStockValue: { $sum: { $multiply: ['$price', '$quantity'] } },
          avgPrice: { $avg: '$price' },
        },
      },
      { $sort: { totalStockValue: -1 } },
    ]);

    res.json({ categories: summary.length, summary });
  } catch (err) {
    next(err);
  }
};
