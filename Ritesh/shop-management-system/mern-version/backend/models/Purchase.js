const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
  productName: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: [0, 'Unit price cannot be negative']
  },
  totalPrice: {
    type: Number,
    required: true
  }
});

const purchaseSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer is required']
  },
  items: [purchaseItemSchema],
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'overdue', 'cancelled'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'bank_transfer', 'upi', 'wallet', 'other'],
    default: 'cash'
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: [0, 'Paid amount cannot be negative']
  },
  remainingAmount: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  invoiceNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Pre-save middleware to calculate totals
purchaseSchema.pre('save', function(next) {
  // Calculate total amount from items if not provided
  if (this.items && this.items.length > 0) {
    let calculatedTotal = 0;
    this.items.forEach(item => {
      item.totalPrice = item.quantity * item.unitPrice;
      calculatedTotal += item.totalPrice;
    });
    
    if (!this.totalAmount) {
      this.totalAmount = calculatedTotal;
    }
  }
  
  // Calculate remaining amount
  this.remainingAmount = this.totalAmount - this.paidAmount;
  
  // Update payment status based on remaining amount
  if (this.remainingAmount <= 0) {
    this.paymentStatus = 'completed';
  } else if (this.dueDate && new Date() > this.dueDate) {
    this.paymentStatus = 'overdue';
  }
  
  next();
});

// Post-save middleware to update customer statistics
purchaseSchema.post('save', async function() {
  try {
    const Customer = mongoose.model('Customer');
    const customer = await Customer.findById(this.customer);
    if (customer) {
      await customer.updatePurchaseStats();
    }
  } catch (error) {
    console.error('Error updating customer stats:', error);
  }
});

// Index for faster queries
purchaseSchema.index({ customer: 1 });
purchaseSchema.index({ purchaseDate: -1 });
purchaseSchema.index({ paymentStatus: 1 });
purchaseSchema.index({ createdBy: 1 });

// Virtual for overdue status
purchaseSchema.virtual('isOverdue').get(function() {
  return this.dueDate && new Date() > this.dueDate && this.remainingAmount > 0;
});

module.exports = mongoose.model('Purchase', purchaseSchema);
