const config = require('../config/config');

// API Key Authentication Middleware
exports.apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers['X-API-Key'];
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key is required'
    });
  }

  // Check if API key matches the one in environment/config
  if (apiKey !== config.apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Invalid API key'
    });
  }

  // API key is valid, proceed to next middleware
  next();
};

// Optional: Bearer Token Authentication (for future use)
exports.bearerAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Bearer token is required'
    });
  }

  const token = authHeader.substring(7);
  
  // TODO: Implement JWT verification or token validation
  // For now, just check if token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }

  req.token = token;
  next();
};

// Instance ownership verification middleware
exports.verifyInstanceOwnership = async (req, res, next) => {
  const { instanceId } = req.params;
  
  if (!instanceId) {
    return res.status(400).json({
      success: false,
      error: 'Instance ID is required'
    });
  }

  // TODO: Implement ownership verification logic
  // For now, just check if instanceId is valid UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(instanceId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid instance ID format'
    });
  }

  next();
};
