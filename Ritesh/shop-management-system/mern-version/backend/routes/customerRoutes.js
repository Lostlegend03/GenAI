const express = require('express');
const Customer = require('../models/Customer');
const Purchase = require('../models/Purchase');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Apply protection to all routes
router.use(protect);

// @desc    Get all customers with search, filter and pagination
// @route   GET /api/customers
// @access  Private
const getCustomers = asyncHandler(async (req, res, next) => {
  const { 
    search, 
    page = 1, 
    limit = 10, 
    sortBy = 'createdAt', 
    sortOrder = 'desc',
    isActive 
  } = req.query;

  // Build filter
  const filter = { createdBy: req.user._id };
  
  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }

  // Build query
  let query = Customer.find(filter);

  // Add search if provided
  if (search) {
    query = query.find({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ]
    });
  }

  // Add sorting
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
  query = query.sort(sortOptions);

  // Execute query with pagination
  const customers = await query
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .populate('purchases', 'totalAmount purchaseDate paymentStatus');

  // Get total count for pagination
  const totalCustomers = await Customer.countDocuments({
    ...filter,
    ...(search ? {
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ]
    } : {})
  });

  res.status(200).json({
    status: 'success',
    results: customers.length,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCustomers / limit),
      totalResults: totalCustomers,
      hasNextPage: page < Math.ceil(totalCustomers / limit),
      hasPrevPage: page > 1
    },
    data: {
      customers
    }
  });
});

// @desc    Get single customer
// @route   GET /api/customers/:id
// @access  Private
const getCustomer = asyncHandler(async (req, res, next) => {
  const customer = await Customer.findOne({
    _id: req.params.id,
    createdBy: req.user._id
  }).populate({
    path: 'purchases',
    select: 'totalAmount purchaseDate paymentStatus items',
    options: { sort: { purchaseDate: -1 } }
  });

  if (!customer) {
    const error = new Error('Customer not found');
    error.statusCode = 404;
    error.status = 'fail';
    return next(error);
  }

  res.status(200).json({
    status: 'success',
    data: {
      customer
    }
  });
});

// @desc    Create new customer
// @route   POST /api/customers
// @access  Private
const createCustomer = asyncHandler(async (req, res, next) => {
  const customerData = {
    ...req.body,
    createdBy: req.user._id
  };

  const customer = await Customer.create(customerData);

  // Emit real-time update
  const io = req.app.get('socketio');
  io.to(req.user._id.toString()).emit('customer_created', customer);

  res.status(201).json({
    status: 'success',
    message: 'Customer created successfully',
    data: {
      customer
    }
  });
});

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private
const updateCustomer = asyncHandler(async (req, res, next) => {
  const customer = await Customer.findOneAndUpdate(
    {
      _id: req.params.id,
      createdBy: req.user._id
    },
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  if (!customer) {
    const error = new Error('Customer not found');
    error.statusCode = 404;
    error.status = 'fail';
    return next(error);
  }

  // Emit real-time update
  const io = req.app.get('socketio');
  io.to(req.user._id.toString()).emit('customer_updated', customer);

  res.status(200).json({
    status: 'success',
    message: 'Customer updated successfully',
    data: {
      customer
    }
  });
});

// @desc    Delete customer
// @route   DELETE /api/customers/:id
// @access  Private
const deleteCustomer = asyncHandler(async (req, res, next) => {
  const customer = await Customer.findOne({
    _id: req.params.id,
    createdBy: req.user._id
  });

  if (!customer) {
    const error = new Error('Customer not found');
    error.statusCode = 404;
    error.status = 'fail';
    return next(error);
  }

  // Check if customer has purchases
  const purchaseCount = await Purchase.countDocuments({ customer: customer._id });
  
  if (purchaseCount > 0) {
    // Instead of deleting, mark as inactive
    customer.isActive = false;
    await customer.save();
    
    // Emit real-time update
    const io = req.app.get('socketio');
    io.to(req.user._id.toString()).emit('customer_deactivated', customer);
    
    return res.status(200).json({
      status: 'success',
      message: 'Customer has been deactivated due to existing purchase history'
    });
  }

  await Customer.findByIdAndDelete(req.params.id);

  // Emit real-time update
  const io = req.app.get('socketio');
  io.to(req.user._id.toString()).emit('customer_deleted', { id: req.params.id });

  res.status(204).json({
    status: 'success',
    message: 'Customer deleted successfully'
  });
});

// @desc    Get customer purchase history
// @route   GET /api/customers/:id/purchases
// @access  Private
const getCustomerPurchases = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  
  const customer = await Customer.findOne({
    _id: req.params.id,
    createdBy: req.user._id
  });

  if (!customer) {
    const error = new Error('Customer not found');
    error.statusCode = 404;
    error.status = 'fail';
    return next(error);
  }

  const purchases = await Purchase.find({ customer: req.params.id })
    .sort({ purchaseDate: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const totalPurchases = await Purchase.countDocuments({ customer: req.params.id });

  res.status(200).json({
    status: 'success',
    results: purchases.length,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalPurchases / limit),
      totalResults: totalPurchases
    },
    data: {
      customer: {
        name: customer.name,
        email: customer.email
      },
      purchases
    }
  });
});

// @desc    Get customers with overdue payments
// @route   GET /api/customers/overdue
// @access  Private
const getOverdueCustomers = asyncHandler(async (req, res, next) => {
  const overdueCustomers = await Customer.aggregate([
    {
      $match: { createdBy: req.user._id }
    },
    {
      $lookup: {
        from: 'purchases',
        localField: '_id',
        foreignField: 'customer',
        as: 'purchases'
      }
    },
    {
      $match: {
        'purchases': {
          $elemMatch: {
            $and: [
              { dueDate: { $lt: new Date() } },
              { remainingAmount: { $gt: 0 } }
            ]
          }
        }
      }
    },
    {
      $project: {
        name: 1,
        email: 1,
        phone: 1,
        overduePurchases: {
          $filter: {
            input: '$purchases',
            cond: {
              $and: [
                { $lt: ['$$this.dueDate', new Date()] },
                { $gt: ['$$this.remainingAmount', 0] }
              ]
            }
          }
        }
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    results: overdueCustomers.length,
    data: {
      customers: overdueCustomers
    }
  });
});

// Routes
router.route('/')
  .get(getCustomers)
  .post(createCustomer);

router.get('/overdue', getOverdueCustomers);

router.route('/:id')
  .get(getCustomer)
  .put(updateCustomer)
  .delete(deleteCustomer);

router.get('/:id/purchases', getCustomerPurchases);

module.exports = router;
