const express = require('express');
const router = express.Router();
const instanceController = require('../controllers/instanceController');
const authController = require('../controllers/authController');

// Apply authentication middleware to all routes
router.use(authController.validateApiKey);

// Instance management routes
router.post('/create', instanceController.create);
router.delete('/:instanceId', instanceController.delete);
router.get('/:instanceId/status', instanceController.getStatus);
router.get('/:instanceId/qr', instanceController.getQR);
router.post('/:instanceId/pairing-code', instanceController.requestPairingCode);
router.get('/:instanceId/pairing-code', instanceController.getPairingCode);
router.get('/:instanceId/info', instanceController.getInfo);
router.put('/:instanceId', instanceController.update);
router.post('/:instanceId/restart', instanceController.restart);
router.post('/:instanceId/logout', instanceController.logout);
router.get('/', instanceController.getAll);

module.exports = router;
