const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [40, 'SKU cannot exceed 40 characters'],
      match: [/^[A-Z0-9-]+$/, 'SKU may contain only letters, numbers and hyphens'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      maxlength: [50, 'Category cannot exceed 50 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be a whole number',
      },
    },
    reorderLevel: {
      type: Number,
      default: 10,
      min: [0, 'Reorder level cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Reorder level must be a whole number',
      },
    },
    supplier: {
      type: String,
      trim: true,
      maxlength: [100, 'Supplier cannot exceed 100 characters'],
      default: 'Unknown',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// stockValue = price * quantity (computed, not stored)
productSchema.virtual('stockValue').get(function () {
  return this.price * this.quantity;
});

productSchema.index({ category: 1 });

module.exports = mongoose.model('Product', productSchema);
