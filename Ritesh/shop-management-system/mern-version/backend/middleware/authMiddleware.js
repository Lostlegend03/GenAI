const jwt = require('jsonwebtoken');
const User = require('../models/User');

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Protect routes - verify JWT token
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Get token from header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Make sure token exists
  if (!token) {
    const error = new Error('Not authorized to access this route');
    error.statusCode = 401;
    error.status = 'fail';
    return next(error);
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from the token
    const currentUser = await User.findById(decoded.id).select('+password');

    if (!currentUser) {
      const error = new Error('The user belonging to this token no longer exists');
      error.statusCode = 401;
      error.status = 'fail';
      return next(error);
    }

    // Check if user is active
    if (!currentUser.isActive) {
      const error = new Error('Your account has been deactivated. Please contact support.');
      error.statusCode = 401;
      error.status = 'fail';
      return next(error);
    }

    // Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      const error = new Error('User recently changed password! Please log in again.');
      error.statusCode = 401;
      error.status = 'fail';
      return next(error);
    }

    // Grant access to protected route
    req.user = currentUser;
    next();
  } catch (error) {
    const err = new Error('Not authorized to access this route');
    err.statusCode = 401;
    err.status = 'fail';
    return next(err);
  }
});

// Grant access to specific roles
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      const error = new Error('You do not have permission to perform this action');
      error.statusCode = 403;
      error.status = 'fail';
      return next(error);
    }
    next();
  };
};

// Check if user owns the resource (for data access control)
const checkOwnership = (resourceModel, resourceField = 'createdBy') => {
  return asyncHandler(async (req, res, next) => {
    const resource = await resourceModel.findById(req.params.id);
    
    if (!resource) {
      const error = new Error('Resource not found');
      error.statusCode = 404;
      error.status = 'fail';
      return next(error);
    }

    // Admin and owner can access any resource
    if (req.user.role === 'owner') {
      return next();
    }

    // Check if user owns the resource
    if (resource[resourceField].toString() !== req.user._id.toString()) {
      const error = new Error('You can only access your own data');
      error.statusCode = 403;
      error.status = 'fail';
      return next(error);
    }

    next();
  });
};

module.exports = {
  protect,
  restrictTo,
  checkOwnership
};
