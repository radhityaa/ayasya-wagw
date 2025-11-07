const { PrismaClient } = require('@prisma/client');
const whatsappService = require('../services/whatsappService');

const prisma = new PrismaClient();

// Get my profile
exports.getProfile = async (req, res, next) => {
  try {
    const { instanceId } = req.params;
    
    // Get WhatsApp instance directly from whatsappService
    const instance = whatsappService.getInstance(instanceId);
    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found'
      });
    }

    // Get socket from instance
    const sock = instance.socket;
    if (!sock || !sock.user) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp not connected'
      });
    }

    // Get profile picture URL
    let profilePictureUrl = null;
    try {
      profilePictureUrl = await sock.profilePictureUrl(sock.user.id, 'image');
    } catch (err) {
      // Profile picture might not be set
      console.log('No profile picture found');
    }

    // Get status/about
    let status = null;
    try {
      const statusResult = await sock.fetchStatus(sock.user.id);
      status = statusResult?.status || null;
    } catch (err) {
      console.log('Could not fetch status');
    }

    const profile = {
      id: sock.user.id,
      name: sock.user.name || sock.user.verifiedName || 'Unknown',
      phone: sock.user.id.split('@')[0].replace(':', '+'),
      profilePicture: profilePictureUrl,
      status: status,
      platform: sock.user.platform || 'unknown'
    };

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

// Update profile name
exports.updateProfileName = async (req, res, next) => {
  try {
    const { instanceId } = req.params;
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }

    if (name.length > 25) {
      return res.status(400).json({
        success: false,
        error: 'Name must be 25 characters or less'
      });
    }

    // Get WhatsApp instance
    const instance = whatsappService.getInstance(instanceId);
    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found'
      });
    }

    const sock = instance.socket;
    if (!sock || !sock.user) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp not connected'
      });
    }

    // Check if app state is ready
    if (!whatsappService.isAppStateReady(instanceId)) {
      // Wait a bit more for app state to sync
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check again
      if (!whatsappService.isAppStateReady(instanceId)) {
        return res.status(503).json({
          success: false,
          error: 'WhatsApp is still synchronizing. Please wait a few moments and try again.',
          details: 'Profile updates require full synchronization with WhatsApp servers. This usually takes 5-10 seconds after connection.',
          retryAfter: 5
        });
      }
    }

    // Try to update profile name
    try {
      await sock.updateProfileName(name.trim());
      
      // Update in database
      await prisma.instance.update({
        where: { id: instanceId },
        data: { 
          name: name.trim(),
          updatedAt: new Date()
        }
      });

      res.json({
        success: true,
        message: 'Profile name updated successfully',
        data: {
          name: name.trim()
        }
      });
    } catch (updateError) {
      console.error('Profile name update error:', updateError);
      
      // If the update fails due to missing app state, return a more informative error
      if (updateError.message && updateError.message.includes('App state key')) {
        // Mark app state as not ready
        whatsappService.appStateReady.set(instanceId, false);
        
        return res.status(503).json({
          success: false,
          error: 'Profile update failed. WhatsApp needs to re-synchronize.',
          details: 'Please wait a few moments for the connection to stabilize and try again.',
          retryAfter: 10
        });
      }
      
      throw updateError;
    }
  } catch (error) {
    next(error);
  }
};

// Update profile status (about)
exports.updateProfileStatus = async (req, res, next) => {
  try {
    const { instanceId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    if (status.length > 139) {
      return res.status(400).json({
        success: false,
        error: 'Status must be 139 characters or less'
      });
    }

    // Get WhatsApp instance
    const instance = whatsappService.getInstance(instanceId);
    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found'
      });
    }

    const sock = instance.socket;
    if (!sock || !sock.user) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp not connected'
      });
    }

    // Try to update profile status/about
    try {
      await sock.updateProfileStatus(status);

      res.json({
        success: true,
        message: 'Profile status updated successfully',
        data: {
          status: status
        }
      });
    } catch (updateError) {
      console.error('Profile status update error:', updateError);
      
      if (updateError.message && updateError.message.includes('App state key')) {
        return res.status(503).json({
          success: false,
          error: 'Profile status update is temporarily unavailable. Please wait for full synchronization.',
          details: 'This feature requires full synchronization with WhatsApp servers.'
        });
      }
      
      throw updateError;
    }
  } catch (error) {
    next(error);
  }
};

// Update profile picture
exports.updateProfilePicture = async (req, res, next) => {
  try {
    const { instanceId } = req.params;
    const { imageUrl, imageBase64 } = req.body;

    if (!imageUrl && !imageBase64) {
      return res.status(400).json({
        success: false,
        error: 'Either imageUrl or imageBase64 is required'
      });
    }

    // Get WhatsApp instance
    const instance = whatsappService.getInstance(instanceId);
    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found'
      });
    }

    const sock = instance.socket;
    if (!sock || !sock.user) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp not connected'
      });
    }

    let imageBuffer;
    
    if (imageBase64) {
      // Convert base64 to buffer
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else if (imageUrl) {
      // Download image from URL
      const axios = require('axios');
      try {
        const response = await axios.get(imageUrl, {
          responseType: 'arraybuffer'
        });
        imageBuffer = Buffer.from(response.data);
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Failed to download image from URL'
        });
      }
    }

    // Try to update profile picture
    try {
      await sock.updateProfilePicture(sock.user.id, imageBuffer);

      res.json({
        success: true,
        message: 'Profile picture updated successfully'
      });
    } catch (updateError) {
      console.error('Profile picture update error:', updateError);
      
      if (updateError.message && updateError.message.includes('App state key')) {
        return res.status(503).json({
          success: false,
          error: 'Profile picture update is temporarily unavailable. Please wait for full synchronization.',
          details: 'This feature requires full synchronization with WhatsApp servers.'
        });
      }
      
      throw updateError;
    }
  } catch (error) {
    next(error);
  }
};

// Delete profile picture
exports.deleteProfilePicture = async (req, res, next) => {
  try {
    const { instanceId } = req.params;

    // Get WhatsApp instance
    const instance = whatsappService.getInstance(instanceId);
    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found'
      });
    }

    const sock = instance.socket;
    if (!sock || !sock.user) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp not connected'
      });
    }

    // Try to remove profile picture
    try {
      await sock.removeProfilePicture(sock.user.id);

      res.json({
        success: true,
        message: 'Profile picture deleted successfully'
      });
    } catch (updateError) {
      console.error('Profile picture delete error:', updateError);
      
      if (updateError.message && updateError.message.includes('App state key')) {
        return res.status(503).json({
          success: false,
          error: 'Profile picture deletion is temporarily unavailable. Please wait for full synchronization.',
          details: 'This feature requires full synchronization with WhatsApp servers.'
        });
      }
      
      throw updateError;
    }
  } catch (error) {
    next(error);
  }
};
