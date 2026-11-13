# Inventory and Data Management System

REST API for product inventory: CRUD, stock movements, low-stock alerts and
category reports. Built with Node.js, Express and MongoDB (Mongoose).

## Run

1. Copy `.env.example` to `.env` and point `MONGO_URI` at your database
   (local MongoDB or Atlas).
2. `npm install`
3. `npm run seed` (optional sample data — **deletes all existing products**)
4. `npm start` → http://localhost:5000

`npm run dev` restarts the server on file changes.

## Endpoints

| Method | URL | Purpose |
|---|---|---|
| POST | `/api/products` | Create product |
| GET | `/api/products` | List (filter/sort/paginate) |
| GET | `/api/products/:id` | Single product |
| PUT | `/api/products/:id` | Update details |
| PATCH | `/api/products/:id/stock` | Body `{ "change": 10 }` restock, `{ "change": -3 }` sale |
| DELETE | `/api/products/:id` | Delete |
| GET | `/api/products/low-stock` | quantity <= reorderLevel |
| GET | `/api/products/summary` | Category-wise aggregation |
| GET | `/health` | API + database readiness |

### Query params for GET /api/products

`category`, `supplier`, `search` (matches name or SKU), `minPrice`, `maxPrice`,
`inStock=true|false`, `sort`, `page`, `limit`.

- `sort` accepts up to 3 fields, `-` for descending: `sort=-price,name`.
  Allowed: `name`, `sku`, `category`, `price`, `quantity`, `reorderLevel`,
  `supplier`, `createdAt`, `updatedAt`.
- `page` >= 1, `limit` 1–100 (default 10).
- `minPrice`/`maxPrice` must be non-negative numbers.

Example: `/api/products?category=Electronics&minPrice=500&sort=-price&page=1&limit=5`

## Validation and errors

- Bodies must be non-empty JSON objects; unknown fields are rejected with `400`
  so typos don't silently vanish.
- `PUT` accepts only writable fields; read-only fields (`id`, `_id`, `createdAt`,
  `updatedAt`, `__v`, `stockValue`) are ignored if echoed back.
- Stock changes must be non-zero safe integers. Negative changes are applied
  atomically with a `quantity >= -change` guard, so concurrent sales can never
  drive stock below zero.
- Errors are JSON: `{ "error": "...", "details": [...] }` with `400` (validation),
  `404` (missing), `409` (duplicate SKU), `413` (body too large) or `500`.
- CORS is open in development. Set `CORS_ORIGIN` to a comma-separated allow-list
  in production.

## Tests

```bash
npm test
```

Uses the Node test runner, Supertest and `mongodb-memory-server`, so no local
MongoDB is required. Covers CRUD, filtering/search/sort/pagination, stock
movements (including oversell protection), low-stock, summary, duplicate SKUs
and validation failures.
