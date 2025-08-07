const express = require('express');
const Purchase = require('../models/Purchase');
const Customer = require('../models/Customer');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Apply protection to all routes
router.use(protect);

// @desc    Get all purchases with filters and pagination
// @route   GET /api/purchases
// @access  Private
const getPurchases = asyncHandler(async (req, res, next) => {
  const { 
    page = 1, 
    limit = 10, 
    sortBy = 'purchaseDate', 
    sortOrder = 'desc',
    paymentStatus,
    customerId,
    startDate,
    endDate
  } = req.query;

  // Build filter
  const filter = { createdBy: req.user._id };
  
  if (paymentStatus) {
    filter.paymentStatus = paymentStatus;
  }
  
  if (customerId) {
    filter.customer = customerId;
  }
  
  if (startDate || endDate) {
    filter.purchaseDate = {};
    if (startDate) filter.purchaseDate.$gte = new Date(startDate);
    if (endDate) filter.purchaseDate.$lte = new Date(endDate);
  }

  // Add sorting
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

  // Execute query with pagination
  const purchases = await Purchase.find(filter)
    .sort(sortOptions)
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .populate('customer', 'name email phone')
    .populate('createdBy', 'name shopName');

  // Get total count for pagination
  const totalPurchases = await Purchase.countDocuments(filter);

  res.status(200).json({
    status: 'success',
    results: purchases.length,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalPurchases / limit),
      totalResults: totalPurchases,
      hasNextPage: page < Math.ceil(totalPurchases / limit),
      hasPrevPage: page > 1
    },
    data: {
      purchases
    }
  });
});

// @desc    Get single purchase
// @route   GET /api/purchases/:id
// @access  Private
const getPurchase = asyncHandler(async (req, res, next) => {
  const purchase = await Purchase.findOne({
    _id: req.params.id,
    createdBy: req.user._id
  }).populate('customer', 'name email phone address');

  if (!purchase) {
    const error = new Error('Purchase not found');
    error.statusCode = 404;
    error.status = 'fail';
    return next(error);
  }

  res.status(200).json({
    status: 'success',
    data: {
      purchase
    }
  });
});

// @desc    Create new purchase
// @route   POST /api/purchases
// @access  Private
const createPurchase = asyncHandler(async (req, res, next) => {
  // Verify customer exists and belongs to user
  const customer = await Customer.findOne({
    _id: req.body.customer,
    createdBy: req.user._id
  });

  if (!customer) {
    const error = new Error('Customer not found');
    error.statusCode = 404;
    error.status = 'fail';
    return next(error);
  }

  const purchaseData = {
    ...req.body,
    createdBy: req.user._id
  };

  const purchase = await Purchase.create(purchaseData);
  
  // Populate customer data
  await purchase.populate('customer', 'name email phone');

  // Emit real-time update
  const io = req.app.get('socketio');
  io.to(req.user._id.toString()).emit('purchase_created', purchase);

  res.status(201).json({
    status: 'success',
    message: 'Purchase created successfully',
    data: {
      purchase
    }
  });
});

// @desc    Update purchase
// @route   PUT /api/purchases/:id
// @access  Private
const updatePurchase = asyncHandler(async (req, res, next) => {
  const purchase = await Purchase.findOneAndUpdate(
    {
      _id: req.params.id,
      createdBy: req.user._id
    },
    req.body,
    {
      new: true,
      runValidators: true
    }
  ).populate('customer', 'name email phone');

  if (!purchase) {
    const error = new Error('Purchase not found');
    error.statusCode = 404;
    error.status = 'fail';
    return next(error);
  }

  // Emit real-time update
  const io = req.app.get('socketio');
  io.to(req.user._id.toString()).emit('purchase_updated', purchase);

  res.status(200).json({
    status: 'success',
    message: 'Purchase updated successfully',
    data: {
      purchase
    }
  });
});

// @desc    Delete purchase
// @route   DELETE /api/purchases/:id
// @access  Private
const deletePurchase = asyncHandler(async (req, res, next) => {
  const purchase = await Purchase.findOne({
    _id: req.params.id,
    createdBy: req.user._id
  });

  if (!purchase) {
    const error = new Error('Purchase not found');
    error.statusCode = 404;
    error.status = 'fail';
    return next(error);
  }

  await Purchase.findByIdAndDelete(req.params.id);

  // Update customer statistics
  const customer = await Customer.findById(purchase.customer);
  if (customer) {
    await customer.updatePurchaseStats();
  }

  // Emit real-time update
  const io = req.app.get('socketio');
  io.to(req.user._id.toString()).emit('purchase_deleted', { 
    id: req.params.id,
    customerId: purchase.customer 
  });

  res.status(204).json({
    status: 'success',
    message: 'Purchase deleted successfully'
  });
});

// @desc    Update payment status
// @route   PUT /api/purchases/:id/payment
// @access  Private
const updatePaymentStatus = asyncHandler(async (req, res, next) => {
  const { paidAmount, paymentStatus, paymentMethod } = req.body;

  const purchase = await Purchase.findOne({
    _id: req.params.id,
    createdBy: req.user._id
  });

  if (!purchase) {
    const error = new Error('Purchase not found');
    error.statusCode = 404;
    error.status = 'fail';
    return next(error);
  }

  // Update payment fields
  if (paidAmount !== undefined) {
    purchase.paidAmount = paidAmount;
  }
  if (paymentStatus) {
    purchase.paymentStatus = paymentStatus;
  }
  if (paymentMethod) {
    purchase.paymentMethod = paymentMethod;
  }

  await purchase.save();
  await purchase.populate('customer', 'name email phone');

  // Emit real-time update
  const io = req.app.get('socketio');
  io.to(req.user._id.toString()).emit('payment_updated', purchase);

  res.status(200).json({
    status: 'success',
    message: 'Payment status updated successfully',
    data: {
      purchase
    }
  });
});

// @desc    Get pending payments
// @route   GET /api/purchases/pending
// @access  Private
const getPendingPayments = asyncHandler(async (req, res, next) => {
  const pendingPurchases = await Purchase.find({
    createdBy: req.user._id,
    paymentStatus: { $in: ['pending', 'overdue'] },
    remainingAmount: { $gt: 0 }
  })
  .populate('customer', 'name email phone')
  .sort({ dueDate: 1, purchaseDate: -1 });

  // Calculate total pending amount
  const totalPending = pendingPurchases.reduce((sum, purchase) => {
    return sum + purchase.remainingAmount;
  }, 0);

  res.status(200).json({
    status: 'success',
    results: pendingPurchases.length,
    data: {
      purchases: pendingPurchases,
      totalPendingAmount: totalPending
    }
  });
});

// @desc    Get overdue payments
// @route   GET /api/purchases/overdue
// @access  Private
const getOverduePayments = asyncHandler(async (req, res, next) => {
  const overduePurchases = await Purchase.find({
    createdBy: req.user._id,
    dueDate: { $lt: new Date() },
    remainingAmount: { $gt: 0 }
  })
  .populate('customer', 'name email phone')
  .sort({ dueDate: 1 });

  // Calculate total overdue amount
  const totalOverdue = overduePurchases.reduce((sum, purchase) => {
    return sum + purchase.remainingAmount;
  }, 0);

  res.status(200).json({
    status: 'success',
    results: overduePurchases.length,
    data: {
      purchases: overduePurchases,
      totalOverdueAmount: totalOverdue
    }
  });
});

// @desc    Get daily sales summary
// @route   GET /api/purchases/daily-summary
// @access  Private
const getDailySummary = asyncHandler(async (req, res, next) => {
  const { date } = req.query;
  const targetDate = date ? new Date(date) : new Date();
  
  // Set date range for the day
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const dailyStats = await Purchase.aggregate([
    {
      $match: {
        createdBy: req.user._id,
        purchaseDate: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      }
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$totalAmount' },
        totalPaid: { $sum: '$paidAmount' },
        totalPending: { $sum: '$remainingAmount' },
        transactionCount: { $sum: 1 },
        completedPayments: {
          $sum: { $cond: [{ $eq: ['$paymentStatus', 'completed'] }, 1, 0] }
        },
        pendingPayments: {
          $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0] }
        }
      }
    }
  ]);

  const summary = dailyStats.length > 0 ? dailyStats[0] : {
    totalSales: 0,
    totalPaid: 0,
    totalPending: 0,
    transactionCount: 0,
    completedPayments: 0,
    pendingPayments: 0
  };

  res.status(200).json({
    status: 'success',
    data: {
      date: targetDate.toISOString().split('T')[0],
      summary
    }
  });
});

// Routes
router.route('/')
  .get(getPurchases)
  .post(createPurchase);

router.get('/pending', getPendingPayments);
router.get('/overdue', getOverduePayments);
router.get('/daily-summary', getDailySummary);

router.route('/:id')
  .get(getPurchase)
  .put(updatePurchase)
  .delete(deletePurchase);

router.put('/:id/payment', updatePaymentStatus);

module.exports = router;
