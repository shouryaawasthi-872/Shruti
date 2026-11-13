const HttpError = require('./httpError');

// Sorting is whitelisted so arbitrary paths (or malformed input) never reach Mongoose.
const SORTABLE_FIELDS = [
  'name',
  'sku',
  'category',
  'price',
  'quantity',
  'reorderLevel',
  'supplier',
  'createdAt',
  'updatedAt',
];

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "sort=-price,name" -> { price: -1, name: 1 }; defaults to newest first.
const parseSort = (raw) => {
  if (raw === undefined || raw === '') return { createdAt: -1 };

  const parts = String(raw)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) throw new HttpError(400, 'sort cannot be empty');
  if (parts.length > 3) throw new HttpError(400, 'sort accepts at most 3 fields');

  const sort = {};
  for (const part of parts) {
    const descending = part.startsWith('-');
    const field = descending ? part.slice(1) : part;

    if (!SORTABLE_FIELDS.includes(field)) {
      throw new HttpError(
        400,
        `Cannot sort by "${field}". Allowed fields: ${SORTABLE_FIELDS.join(', ')}`
      );
    }
    sort[field] = descending ? -1 : 1;
  }

  return sort;
};

// Parses an optional non-negative number, rejecting NaN/Infinity instead of
// letting Mongoose turn it into a confusing CastError.
const parseNonNegativeNumber = (raw, name) => {
  if (raw === undefined || raw === '') return undefined;

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new HttpError(400, `${name} must be a non-negative number`);
  }
  return value;
};

const parseIntegerParam = (raw, name, { min, max, fallback }) => {
  if (raw === undefined || raw === '') return fallback;

  if (!/^\d+$/.test(String(raw))) {
    throw new HttpError(400, `${name} must be a positive integer`);
  }

  const value = Number(raw);
  if (value < min || value > max) {
    throw new HttpError(400, `${name} must be between ${min} and ${max}`);
  }
  return value;
};

const parsePagination = (rawPage, rawLimit) => ({
  page: parseIntegerParam(rawPage, 'page', { min: 1, max: 1_000_000, fallback: 1 }),
  limit: parseIntegerParam(rawLimit, 'limit', { min: 1, max: 100, fallback: 10 }),
});

module.exports = {
  SORTABLE_FIELDS,
  escapeRegex,
  parseSort,
  parseNonNegativeNumber,
  parsePagination,
};
