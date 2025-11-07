const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { apiKeyAuth } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(apiKeyAuth);

// Event routes
router.post('/:instanceId', eventController.sendEvent);

module.exports = router;
