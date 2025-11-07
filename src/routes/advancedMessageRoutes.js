const express = require('express');
const router = express.Router();
const advancedMessageController = require('../controllers/advancedMessageController');
const { apiKeyAuth } = require('../middleware/auth');

// Apply API key authentication to all routes
router.use(apiKeyAuth);

// ============= BASIC MESSAGING ROUTES =============

// Send text message
router.post('/send/text', advancedMessageController.sendText);

// Send image
router.post('/send/image', advancedMessageController.sendImage);

// Send file/document
router.post('/send/file', advancedMessageController.sendFile);

// Send voice/audio
router.post('/send/voice', advancedMessageController.sendVoice);

// Send video
router.post('/send/video', advancedMessageController.sendVideo);

// Send link with custom preview
router.post('/send/link-preview', advancedMessageController.sendLinkPreview);

// ============= INTERACTIVE MESSAGES ROUTES =============

// Send list message
router.post('/send/list', advancedMessageController.sendListMessage);

// Send button reply message
router.post('/send/buttons', advancedMessageController.sendButtonReply);

// Send poll
router.post('/send/poll', advancedMessageController.sendPoll);

// Send poll vote
router.post('/send/poll-vote', advancedMessageController.sendPollVote);

// ============= LOCATION & CONTACT ROUTES =============

// Send location
router.post('/send/location', advancedMessageController.sendLocation);

// Send contact vCard
router.post('/send/contact', advancedMessageController.sendContact);

// ============= MESSAGE ACTIONS ROUTES =============

// Forward message
router.post('/forward', advancedMessageController.forwardMessage);

// Send seen/read receipt
router.post('/seen', advancedMessageController.sendSeen);

// Start typing indicator
router.post('/typing/start', advancedMessageController.startTyping);

// Stop typing indicator
router.post('/typing/stop', advancedMessageController.stopTyping);

// Add reaction to message
router.put('/reaction', advancedMessageController.addReaction);

// Star/unstar message
router.put('/star', advancedMessageController.starMessage);

module.exports = router;
