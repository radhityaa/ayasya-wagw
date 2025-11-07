const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { apiKeyAuth } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(apiKeyAuth);

// Contact routes
router.get('/:instanceId/all', contactController.getAllContacts);
router.get('/:instanceId', contactController.getContactInfo);
router.get('/:instanceId/check-exists', contactController.checkExists);
router.get('/:instanceId/about', contactController.getProfilePicture);
router.post('/:instanceId/block', contactController.blockContact);
router.post('/:instanceId/unblock', contactController.unblockContact);
router.put('/:instanceId/:chatId', contactController.updateContact);

// LID routes
router.get('/:instanceId/lids', contactController.getAllLids);
router.get('/:instanceId/lids/count', contactController.getLidsCount);
router.get('/:instanceId/lids/:lid', contactController.getPhoneNumberByLid);
router.get('/:instanceId/lids/pn/:phoneNumber', contactController.getLidByPhoneNumber);

module.exports = router;
