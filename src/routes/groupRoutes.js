const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { apiKeyAuth } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(apiKeyAuth);

// Group management routes
router.get('/:instanceId', groupController.getGroups);
router.post('/:instanceId', groupController.createGroup);
router.get('/:instanceId/count', groupController.getGroupsCount);
router.post('/:instanceId/refresh', groupController.refreshGroups);
router.get('/:instanceId/join-info', groupController.getJoinInfoGroup);
router.post('/:instanceId/join', groupController.joinGroup);

// Specific group routes
router.get('/:instanceId/:groupId', groupController.getGroupById);
router.delete('/:instanceId/:groupId', groupController.deleteGroup);
router.post('/:instanceId/:groupId/leave', groupController.leaveGroup);

// Group invite code routes
router.get('/:instanceId/:groupId/invite-code', groupController.getGroupInviteCode);
router.post('/:instanceId/:groupId/invite-code/revoke', groupController.revokeGroupInviteCode);

// Group participants routes
router.get('/:instanceId/:groupId/participants', groupController.getGroupParticipants);
router.post('/:instanceId/:groupId/participants/add', groupController.addGroupParticipants);
router.post('/:instanceId/:groupId/participants/remove', groupController.removeGroupParticipants);

// Group admin routes
router.post('/:instanceId/:groupId/admin/promote', groupController.promoteGroupParticipants);
router.post('/:instanceId/:groupId/admin/demote', groupController.demoteGroupParticipants);

// Group picture routes
router.get('/:instanceId/:groupId/picture', groupController.getGroupPicture);
router.put('/:instanceId/:groupId/picture', groupController.setGroupPicture);
router.delete('/:instanceId/:groupId/picture', groupController.deleteGroupPicture);

// Group info routes
router.put('/:instanceId/:groupId/description', groupController.updateGroupDescription);
router.put('/:instanceId/:groupId/subject', groupController.updateGroupSubject);

// Group settings routes
router.put('/:instanceId/:groupId/settings/security/info-admin-only', groupController.updateGroupSettingsInfoAdminOnly);
router.get('/:instanceId/:groupId/settings/security/info-admin-only', groupController.getGroupSettingsInfoAdminOnly);
router.put('/:instanceId/:groupId/settings/security/messages-admin-only', groupController.updateGroupSettingsMessagesAdminOnly);
router.get('/:instanceId/:groupId/settings/security/messages-admin-only', groupController.getGroupSettingsMessagesAdminOnly);

module.exports = router;
