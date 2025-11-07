const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController.js');
const { apiKeyAuth } = require('../middleware/auth');

// Get my profile
router.get('/:instanceId', apiKeyAuth, profileController.getProfile);

// Update profile name
router.put('/:instanceId/name', apiKeyAuth, profileController.updateProfileName);

// Update profile status (about)
router.put('/:instanceId/status', apiKeyAuth, profileController.updateProfileStatus);

// Update profile picture
router.put('/:instanceId/picture', apiKeyAuth, profileController.updateProfilePicture);

// Delete profile picture
router.delete('/:instanceId/picture', apiKeyAuth, profileController.deleteProfilePicture);

module.exports = router;
