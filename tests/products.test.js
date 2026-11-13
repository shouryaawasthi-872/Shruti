process.env.NODE_ENV = 'test';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../app');
const Product = require('../models/Product');

let mongo;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: 'inventory_test' });
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Product.deleteMany({});
});

const sample = (overrides = {}) => ({
  name: 'Wireless Mouse',
  sku: 'ELEC-MS-002',
  category: 'Electronics',
  price: 799,
  quantity: 50,
  reorderLevel: 10,
  supplier: 'Logitech',
  ...overrides,
});

const create = async (overrides) => {
  const res = await request(app).post('/api/products').send(sample(overrides));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
};

test('POST /api/products creates a product and exposes the stockValue virtual', async () => {
  const body = await create({ quantity: 4, price: 250 });

  assert.equal(body.sku, 'ELEC-MS-002');
  assert.equal(body.quantity, 4);
  assert.equal(body.stockValue, 1000);
  assert.ok(body.id);
});

test('POST /api/products rejects a missing name with field details', async () => {
  const payload = sample();
  delete payload.name;

  const res = await request(app).post('/api/products').send(payload);

  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Validation failed');
  assert.ok(res.body.details.some((detail) => /name/i.test(detail)));
});

test('POST /api/products rejects unknown fields instead of silently dropping them', async () => {
  const res = await request(app)
    .post('/api/products')
    .send(sample({ pricee: 12 }));

  assert.equal(res.status, 400);
  assert.match(res.body.error, /Unknown field\(s\): pricee/);
});

test('POST /api/products normalises SKU casing and rejects duplicates with 409', async () => {
  await create({ sku: 'elec-ms-002' });
  const res = await request(app).post('/api/products').send(sample());

  assert.equal(res.status, 409);
  assert.match(res.body.error, /Duplicate value for sku/);
});

test('GET /api/products filters, searches, sorts and paginates', async () => {
  await create({ name: 'Cheap Cable', sku: 'ELEC-CB-001', price: 99 });
  await create({ name: 'Wireless Mouse', sku: 'ELEC-MS-002', price: 799 });
  await create({ name: 'Office Chair', sku: 'FURN-CH-101', category: 'Furniture', price: 5499 });

  const page = await request(app).get('/api/products?sort=price&page=1&limit=2');
  assert.equal(page.status, 200);
  assert.equal(page.body.total, 3);
  assert.equal(page.body.totalPages, 2);
  assert.equal(page.body.count, 2);
  assert.equal(page.body.products[0].price, 99);

  const bySku = await request(app).get('/api/products?search=FURN-CH');
  assert.equal(bySku.body.total, 1);
  assert.equal(bySku.body.products[0].sku, 'FURN-CH-101');

  const byCategory = await request(app).get('/api/products?category=furniture');
  assert.equal(byCategory.body.total, 1);

  const inStock = await request(app).get('/api/products?inStock=false');
  assert.equal(inStock.body.total, 0);
});

test('GET /api/products rejects invalid sort, price and pagination values', async () => {
  const badSort = await request(app).get('/api/products?sort=__v');
  assert.equal(badSort.status, 400);
  assert.match(badSort.body.error, /Cannot sort by "__v"/);

  const badPrice = await request(app).get('/api/products?minPrice=cheap');
  assert.equal(badPrice.status, 400);

  const badPage = await request(app).get('/api/products?page=abc');
  assert.equal(badPage.status, 400);

  const tooBig = await request(app).get('/api/products?limit=500');
  assert.equal(tooBig.status, 400);
});

test('GET /api/products/:id validates the id and returns 404 for unknown products', async () => {
  const invalid = await request(app).get('/api/products/not-an-id');
  assert.equal(invalid.status, 400);

  const missing = await request(app).get(`/api/products/${new mongoose.Types.ObjectId()}`);
  assert.equal(missing.status, 404);
});

test('PATCH /api/products/:id/stock restocks, sells, and blocks overselling', async () => {
  const product = await create({ quantity: 3 });

  const restock = await request(app)
    .patch(`/api/products/${product.id}/stock`)
    .send({ change: 10 });
  assert.equal(restock.status, 200);
  assert.equal(restock.body.product.quantity, 13);

  const sale = await request(app)
    .patch(`/api/products/${product.id}/stock`)
    .send({ change: -3 });
  assert.equal(sale.body.product.quantity, 10);

  const oversell = await request(app)
    .patch(`/api/products/${product.id}/stock`)
    .send({ change: -11 });
  assert.equal(oversell.status, 400);
  assert.match(oversell.body.error, /Insufficient stock/);

  const unchanged = await request(app).get(`/api/products/${product.id}`);
  assert.equal(unchanged.body.quantity, 10);
});

test('PATCH /api/products/:id/stock rejects zero and non-integer changes', async () => {
  const product = await create();

  for (const change of [0, 1.5, '5', null]) {
    const res = await request(app)
      .patch(`/api/products/${product.id}/stock`)
      .send({ change });
    assert.equal(res.status, 400, `change=${change}`);
  }
});

test('GET /api/products/low-stock returns items at or below their reorder level', async () => {
  await create({ sku: 'LOW-1', quantity: 2, reorderLevel: 5 });
  await create({ sku: 'OK-1', quantity: 50, reorderLevel: 5 });

  const res = await request(app).get('/api/products/low-stock');

  assert.equal(res.status, 200);
  assert.equal(res.body.count, 1);
  assert.equal(res.body.lowStockItems[0].sku, 'LOW-1');
});

test('GET /api/products/summary aggregates by category', async () => {
  await create({ sku: 'ELEC-1', category: 'Electronics', price: 100, quantity: 2 });
  await create({ sku: 'ELEC-2', category: 'Electronics', price: 200, quantity: 3 });
  await create({ sku: 'FURN-1', category: 'Furniture', price: 1000, quantity: 1 });

  const res = await request(app).get('/api/products/summary');

  assert.equal(res.status, 200);
  assert.equal(res.body.categories, 2);
  const electronics = res.body.summary.find((row) => row._id === 'Electronics');
  assert.equal(electronics.totalItems, 2);
  assert.equal(electronics.totalQuantity, 5);
  assert.equal(electronics.totalStockValue, 800);
});

test('PUT /api/products/:id ignores read-only fields and rejects unknown ones', async () => {
  const product = await create();

  const res = await request(app)
    .put(`/api/products/${product.id}`)
    .send({ ...product, price: 999 });

  assert.equal(res.status, 200);
  assert.equal(res.body.price, 999);
  assert.equal(res.body.id, product.id);

  const typo = await request(app)
    .put(`/api/products/${product.id}`)
    .send({ prce: 10 });

  assert.equal(typo.status, 400);
  assert.match(typo.body.error, /Unknown field\(s\): prce/);
});

test('GET /health reports database readiness', async () => {
  const res = await request(app).get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('unknown routes return a JSON 404', async () => {
  const res = await request(app).get('/api/nope');
  assert.equal(res.status, 404);
  assert.match(res.body.error, /Route not found/);
});
