const express = require('express');
const router = express.Router();
const observabilityController = require('../controllers/observabilityController');
const { apiKeyAuth } = require('../middleware/auth');

// Public endpoints (no auth required)
router.get('/ping', observabilityController.ping);
router.get('/health', observabilityController.healthCheck);

// Protected endpoints (require API key)
router.get('/version', apiKeyAuth, observabilityController.getVersion);
router.get('/environment', apiKeyAuth, observabilityController.getEnvironment);
router.get('/status', apiKeyAuth, observabilityController.getStatus);

// Dangerous endpoints (require API key)
router.post('/stop', apiKeyAuth, observabilityController.stopServer);
router.post('/restart', apiKeyAuth, observabilityController.restartServer);

module.exports = router;
