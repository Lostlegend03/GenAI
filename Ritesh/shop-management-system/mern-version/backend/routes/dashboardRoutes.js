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

// @desc    Get dashboard overview statistics
// @route   GET /api/dashboard/overview
// @access  Private
const getDashboardOverview = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  // Get current date ranges
  const today = new Date();
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  // Parallel queries for better performance
  const [
    totalCustomers,
    activeCustomers,
    totalPurchases,
    todayPurchases,
    weeklyPurchases,
    monthlyPurchases,
    pendingPayments,
    overduePayments,
    revenueStats
  ] = await Promise.all([
    // Customer statistics
    Customer.countDocuments({ createdBy: userId }),
    Customer.countDocuments({ createdBy: userId, isActive: true }),
    
    // Purchase statistics
    Purchase.countDocuments({ createdBy: userId }),
    Purchase.countDocuments({ 
      createdBy: userId, 
      purchaseDate: { $gte: startOfToday } 
    }),
    Purchase.countDocuments({ 
      createdBy: userId, 
      purchaseDate: { $gte: startOfWeek } 
    }),
    Purchase.countDocuments({ 
      createdBy: userId, 
      purchaseDate: { $gte: startOfMonth } 
    }),
    
    // Payment statistics
    Purchase.find({
      createdBy: userId,
      paymentStatus: 'pending',
      remainingAmount: { $gt: 0 }
    }).select('remainingAmount'),
    
    Purchase.find({
      createdBy: userId,
      dueDate: { $lt: today },
      remainingAmount: { $gt: 0 }
    }).select('remainingAmount'),
    
    // Revenue statistics
    Purchase.aggregate([
      { $match: { createdBy: userId } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$paidAmount' },
          totalPending: { $sum: '$remainingAmount' }
        }
      }
    ])
  ]);

  // Calculate pending and overdue amounts
  const totalPendingAmount = pendingPayments.reduce((sum, purchase) => 
    sum + purchase.remainingAmount, 0
  );
  
  const totalOverdueAmount = overduePayments.reduce((sum, purchase) => 
    sum + purchase.remainingAmount, 0
  );

  const revenue = revenueStats[0] || {
    totalRevenue: 0,
    totalPaid: 0,
    totalPending: 0
  };

  res.status(200).json({
    status: 'success',
    data: {
      customers: {
        total: totalCustomers,
        active: activeCustomers,
        inactive: totalCustomers - activeCustomers
      },
      purchases: {
        total: totalPurchases,
        today: todayPurchases,
        thisWeek: weeklyPurchases,
        thisMonth: monthlyPurchases
      },
      payments: {
        pending: {
          count: pendingPayments.length,
          amount: totalPendingAmount
        },
        overdue: {
          count: overduePayments.length,
          amount: totalOverdueAmount
        }
      },
      revenue: {
        total: revenue.totalRevenue,
        collected: revenue.totalPaid,
        pending: revenue.totalPending,
        collectionRate: revenue.totalRevenue > 0 ? 
          ((revenue.totalPaid / revenue.totalRevenue) * 100).toFixed(2) : 0
      }
    }
  });
});

// @desc    Get revenue trends (last 30 days)
// @route   GET /api/dashboard/revenue-trends
// @access  Private
const getRevenueTrends = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const revenueTrends = await Purchase.aggregate([
    {
      $match: {
        createdBy: userId,
        purchaseDate: { $gte: thirtyDaysAgo }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$purchaseDate' },
          month: { $month: '$purchaseDate' },
          day: { $dayOfMonth: '$purchaseDate' }
        },
        dailyRevenue: { $sum: '$totalAmount' },
        dailyPaid: { $sum: '$paidAmount' },
        transactionCount: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
    },
    {
      $project: {
        date: {
          $dateFromParts: {
            year: '$_id.year',
            month: '$_id.month',
            day: '$_id.day'
          }
        },
        revenue: '$dailyRevenue',
        paid: '$dailyPaid',
        transactions: '$transactionCount'
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      trends: revenueTrends
    }
  });
});

// @desc    Get top customers by purchase value
// @route   GET /api/dashboard/top-customers
// @access  Private
const getTopCustomers = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { limit = 10 } = req.query;

  const topCustomers = await Customer.find({ createdBy: userId })
    .select('name email totalSpent totalPurchases lastPurchaseDate')
    .sort({ totalSpent: -1 })
    .limit(parseInt(limit));

  res.status(200).json({
    status: 'success',
    data: {
      customers: topCustomers
    }
  });
});

// @desc    Get purchase status distribution
// @route   GET /api/dashboard/purchase-status
// @access  Private
const getPurchaseStatusDistribution = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  const statusDistribution = await Purchase.aggregate([
    { $match: { createdBy: userId } },
    {
      $group: {
        _id: '$paymentStatus',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' }
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      distribution: statusDistribution
    }
  });
});

// @desc    Get monthly comparison (current vs previous month)
// @route   GET /api/dashboard/monthly-comparison
// @access  Private
const getMonthlyComparison = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const today = new Date();
  
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const previousMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  const [currentMonth, previousMonth] = await Promise.all([
    Purchase.aggregate([
      {
        $match: {
          createdBy: userId,
          purchaseDate: { $gte: currentMonthStart }
        }
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$totalAmount' },
          transactions: { $sum: 1 },
          paid: { $sum: '$paidAmount' }
        }
      }
    ]),
    Purchase.aggregate([
      {
        $match: {
          createdBy: userId,
          purchaseDate: { 
            $gte: previousMonthStart,
            $lte: previousMonthEnd
          }
        }
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$totalAmount' },
          transactions: { $sum: 1 },
          paid: { $sum: '$paidAmount' }
        }
      }
    ])
  ]);

  const current = currentMonth[0] || { revenue: 0, transactions: 0, paid: 0 };
  const previous = previousMonth[0] || { revenue: 0, transactions: 0, paid: 0 };

  // Calculate growth percentages
  const revenueGrowth = previous.revenue > 0 ? 
    (((current.revenue - previous.revenue) / previous.revenue) * 100).toFixed(2) : 0;
  
  const transactionGrowth = previous.transactions > 0 ? 
    (((current.transactions - previous.transactions) / previous.transactions) * 100).toFixed(2) : 0;

  res.status(200).json({
    status: 'success',
    data: {
      currentMonth: {
        revenue: current.revenue,
        transactions: current.transactions,
        paid: current.paid
      },
      previousMonth: {
        revenue: previous.revenue,
        transactions: previous.transactions,
        paid: previous.paid
      },
      growth: {
        revenue: parseFloat(revenueGrowth),
        transactions: parseFloat(transactionGrowth)
      }
    }
  });
});

// @desc    Get recent activities
// @route   GET /api/dashboard/recent-activities
// @access  Private
const getRecentActivities = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { limit = 10 } = req.query;

  const recentPurchases = await Purchase.find({ createdBy: userId })
    .populate('customer', 'name email')
    .select('totalAmount purchaseDate paymentStatus customer')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

  const recentCustomers = await Customer.find({ createdBy: userId })
    .select('name email createdAt')
    .sort({ createdAt: -1 })
    .limit(5);

  res.status(200).json({
    status: 'success',
    data: {
      recentPurchases,
      recentCustomers
    }
  });
});

// Routes
router.get('/overview', getDashboardOverview);
router.get('/revenue-trends', getRevenueTrends);
router.get('/top-customers', getTopCustomers);
router.get('/purchase-status', getPurchaseStatusDistribution);
router.get('/monthly-comparison', getMonthlyComparison);
router.get('/recent-activities', getRecentActivities);

module.exports = router;
