const rateLimit = require('express-rate-limit');
const config = require('../config/config');

// General rate limiter
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for message sending
const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute
  message: {
    success: false,
    error: 'Message rate limit exceeded. Maximum 30 messages per minute allowed'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for bulk messages
const bulkLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 bulk operations per 5 minutes
  message: {
    success: false,
    error: 'Bulk message rate limit exceeded. Maximum 5 bulk operations per 5 minutes allowed'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for instance creation
const instanceLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 instances per hour
  message: {
    success: false,
    error: 'Instance creation rate limit exceeded. Maximum 10 instances per hour allowed'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  messageLimiter,
  bulkLimiter,
  instanceLimiter
};
