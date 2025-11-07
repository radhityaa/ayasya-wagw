const express = require('express');
const router = express.Router();
const channelController = require('../controllers/channelController');
const { apiKeyAuth } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(apiKeyAuth);

// Get list of known channels (subscribed newsletters)
router.get('/:instanceId', (req, res, next) => channelController.getChannels(req, res, next));

// Create a new channel (newsletter) - if user has permission
router.post('/:instanceId', (req, res, next) => channelController.createChannel(req, res, next));

// Get channel info
router.get('/:instanceId/:channelId', (req, res, next) => channelController.getChannelInfo(req, res, next));

// Delete a channel (not supported in Baileys)
router.delete('/:instanceId/:channelId', (req, res, next) => channelController.deleteChannel(req, res, next));

// Get channel messages preview
router.get('/:instanceId/:channelId/messages/preview', (req, res, next) => channelController.getChannelMessagesPreview(req, res, next));

// Follow a channel
router.post('/:instanceId/:channelId/follow', (req, res, next) => channelController.followChannel(req, res, next));

// Unfollow a channel
router.post('/:instanceId/:channelId/unfollow', (req, res, next) => channelController.unfollowChannel(req, res, next));

// Mute a channel
router.post('/:instanceId/:channelId/mute', (req, res, next) => channelController.muteChannel(req, res, next));

// Unmute a channel
router.post('/:instanceId/:channelId/unmute', (req, res, next) => channelController.unmuteChannel(req, res, next));

// Search channels by text (not supported in Baileys)
router.post('/:instanceId/search/by-text', (req, res, next) => channelController.searchChannelsByText(req, res, next));

// Search channels by view (not supported in Baileys)
router.post('/:instanceId/search/by-view', (req, res, next) => channelController.searchChannelsByView(req, res, next));

// Get search views list (not supported in Baileys)
router.get('/search/views', (req, res, next) => channelController.getSearchViews(req, res, next));

// Get search countries list (not supported in Baileys)
router.get('/search/countries', (req, res, next) => channelController.getSearchCountries(req, res, next));

// Get search categories list (not supported in Baileys)
router.get('/search/categories', (req, res, next) => channelController.getSearchCategories(req, res, next));

module.exports = router;
