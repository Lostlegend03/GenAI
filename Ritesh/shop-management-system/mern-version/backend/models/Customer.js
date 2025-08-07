const mongoose = require('mongoose');
const validator = require('validator');

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return /^\+?[\d\s\-\(\)]+$/.test(v);
      },
      message: 'Please provide a valid phone number'
    }
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: {
      type: String,
      default: 'India'
    }
  },
  totalPurchases: {
    type: Number,
    default: 0
  },
  totalSpent: {
    type: Number,
    default: 0
  },
  lastPurchaseDate: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for customer purchases
customerSchema.virtual('purchases', {
  ref: 'Purchase',
  localField: '_id',
  foreignField: 'customer'
});

// Index for faster searches
customerSchema.index({ name: 'text', email: 'text', phone: 'text' });
customerSchema.index({ email: 1 });
customerSchema.index({ phone: 1 });
customerSchema.index({ createdBy: 1 });

// Middleware to update purchase statistics
customerSchema.methods.updatePurchaseStats = async function() {
  const Purchase = mongoose.model('Purchase');
  const stats = await Purchase.aggregate([
    { $match: { customer: this._id } },
    {
      $group: {
        _id: null,
        totalPurchases: { $sum: 1 },
        totalSpent: { $sum: '$totalAmount' },
        lastPurchaseDate: { $max: '$purchaseDate' }
      }
    }
  ]);

  if (stats.length > 0) {
    this.totalPurchases = stats[0].totalPurchases;
    this.totalSpent = stats[0].totalSpent;
    this.lastPurchaseDate = stats[0].lastPurchaseDate;
  }
  
  await this.save();
};

module.exports = mongoose.model('Customer', customerSchema);
