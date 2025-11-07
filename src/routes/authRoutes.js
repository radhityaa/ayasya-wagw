const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// API Key management
router.post('/generate-key', authController.generateApiKey);

// Webhook management
router.post('/webhook/validate', authController.validateApiKey, authController.validateWebhook);
router.get('/webhook/events/:instanceId', authController.validateApiKey, authController.getWebhookEvents);
router.get('/webhook/events', authController.validateApiKey, authController.getWebhookEvents);
router.post('/webhook/retry/:webhookId', authController.validateApiKey, authController.retryWebhook);

module.exports = router;
