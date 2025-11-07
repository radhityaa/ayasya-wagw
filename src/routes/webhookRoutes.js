const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const { apiKeyAuth } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(apiKeyAuth);

// Test webhook URL
router.post('/test', webhookController.testWebhook);

// Get webhook logs
router.get('/logs', webhookController.getWebhookLogs);

// Get specific webhook log
router.get('/logs/:webhookId', webhookController.getWebhookLog);

// Retry failed webhook
router.post('/retry/:webhookId', webhookController.retryWebhook);

// Get webhook statistics
router.get('/stats', webhookController.getWebhookStats);

// Clear webhook logs
router.delete('/logs', webhookController.clearWebhookLogs);

module.exports = router;
