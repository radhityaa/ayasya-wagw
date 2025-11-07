const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');
const { apiKeyAuth } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(apiKeyAuth);

// Media conversion routes
router.post('/:instanceId/convert/voice', mediaController.convertVoice);
router.post('/:instanceId/convert/video', mediaController.convertVideo);

module.exports = router;
