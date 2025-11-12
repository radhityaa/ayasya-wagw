const { PrismaClient } = require('@prisma/client');
const whatsappService = require('../services/whatsappService');

const prisma = new PrismaClient();

class ProfileController {
    // Get my profile
    async getProfile(req, res, next) {
        try {
            const { instanceId } = req.params;

            // Get WhatsApp instance directly from whatsappService
            const instance = whatsappService.getInstance(instanceId);

            if (!instance) {
                return res.status(404).json({
                    success: false,
                    error: 'Instance not found or not connected',
                });
            }

            // Get socket from instance
            const { socket } = instance;

            if (!socket || !socket.user) {
                return res.status(400).json({
                    success: false,
                    error: 'WhatsApp not connected',
                });
            }

            // Get profile picture URL
            let profilePictureUrl = null;
            try {
                profilePictureUrl = await socket.profilePictureUrl(socket.user.id, 'image');
            } catch (err) {
                // Profile picture might not be set
                console.log('No profile picture found');
            }

            // Get status/about
            let status = null;
            try {
                const statusResult = await socket.fetchStatus(socket.user.id);
                status = statusResult?.status || null;
            } catch (err) {
                console.log('Could not fetch status');
            }

            const profile = {
                id: socket.user.id,
                name: socket.user.name || socket.user.verifiedName || 'Unknown',
                phone: socket.user.id.split('@')[0].replace(':', '+'),
                profilePicture: profilePictureUrl,
                status: status,
                platform: socket.user.platform || 'unknown',
            };

            res.json({
                success: true,
                data: profile,
            });
        } catch (error) {
            next(error);
        }
    }

    // Update profile name
    async updateProfileName(req, res, next) {
        try {
            const { instanceId } = req.params;
            const { name } = req.body;

            if (!name || name.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Name is required',
                });
            }

            if (name.length > 25) {
                return res.status(400).json({
                    success: false,
                    error: 'Name must be 25 characters or less',
                });
            }

            // Get WhatsApp instance
            const instance = whatsappService.getInstance(instanceId);

            if (!instance) {
                return res.status(404).json({
                    success: false,
                    error: 'Instance not found',
                });
            }

            const { socket } = instance;

            if (!socket || !socket.user) {
                return res.status(400).json({
                    success: false,
                    error: 'WhatsApp not connected',
                });
            }

            // Check if app state is ready for profile updates
            if (!instance.appStateReady) {
                console.log(`Profile update blocked for ${instanceId} - app state not ready`);
                return res.status(503).json({
                    success: false,
                    error: 'Profile update not available yet',
                    details: 'App state is not fully synchronized. Please wait a moment and try again.',
                    hint: 'Make sure the instance has completed initial synchronization (usually takes 10-30 seconds after connection)',
                });
            }

            // Try to update profile name with retry logic
            let retries = 3;
            let lastError = null;

            while (retries > 0) {
                try {
                    await socket.updateProfileName(name.trim());

                    // Update in database
                    await prisma.instance.update({
                        where: { id: instanceId },
                        data: {
                            name: name.trim(),
                            updatedAt: new Date(),
                        },
                    });

                    res.json({
                        success: true,
                        message: 'Profile name updated successfully',
                        data: {
                            name: name.trim(),
                        },
                    });
                    return;
                } catch (updateError) {
                    lastError = updateError;

                    // Check if it's an app state key error
                    if (updateError.message && updateError.message.includes('App state key')) {
                        console.warn(`App state key not present (attempt ${4 - retries}/3), retrying in 2 seconds...`);
                        retries--;

                        if (retries > 0) {
                            // Wait 2 seconds before retrying
                            await new Promise((resolve) => setTimeout(resolve, 2000));
                        }
                    } else {
                        // Different error, don't retry
                        throw updateError;
                    }
                }
            }

            // All retries failed
            console.error('Profile name update failed after 3 retries:', lastError);
            return res.status(503).json({
                success: false,
                error: 'Profile name update failed',
                details: 'App state is not fully synchronized. Please wait a moment and try again.',
                hint: 'Make sure the instance has completed initial synchronization (usually takes 10-30 seconds after connection)',
            });
        } catch (error) {
            next(error);
        }
    }

    // Update profile status (about)
    async updateProfileStatus(req, res, next) {
        try {
            const { instanceId } = req.params;
            const { status } = req.body;

            if (!status) {
                return res.status(400).json({
                    success: false,
                    error: 'Status is required',
                });
            }

            if (status.length > 139) {
                return res.status(400).json({
                    success: false,
                    error: 'Status must be 139 characters or less',
                });
            }

            // Get WhatsApp instance
            const instance = whatsappService.getInstance(instanceId);
            if (!instance) {
                return res.status(404).json({
                    success: false,
                    error: 'Instance not found',
                });
            }

            const sock = instance.socket;
            if (!sock || !sock.user) {
                return res.status(400).json({
                    success: false,
                    error: 'WhatsApp not connected',
                });
            }

            // Check if app state is ready for profile updates
            if (!instance.appStateReady) {
                return res.status(503).json({
                    success: false,
                    error: 'Profile update not available yet',
                    details: 'App state is not fully synchronized. Please wait a moment and try again.',
                    hint: 'Make sure the instance has completed initial synchronization (usually takes 10-30 seconds after connection)',
                });
            }

            // Try to update profile status with retry logic
            let retries = 3;
            let lastError = null;

            while (retries > 0) {
                try {
                    await sock.updateProfileStatus(status);

                    res.json({
                        success: true,
                        message: 'Profile status updated successfully',
                        data: {
                            status: status,
                        },
                    });
                    return;
                } catch (updateError) {
                    lastError = updateError;

                    // Check if it's an app state key error
                    if (updateError.message && updateError.message.includes('App state key')) {
                        console.warn(`App state key not present (attempt ${4 - retries}/3), retrying in 2 seconds...`);
                        retries--;

                        if (retries > 0) {
                            // Wait 2 seconds before retrying
                            await new Promise((resolve) => setTimeout(resolve, 2000));
                        }
                    } else {
                        // Different error, don't retry
                        throw updateError;
                    }
                }
            }

            // All retries failed
            console.error('Profile status update failed after 3 retries:', lastError);
            return res.status(503).json({
                success: false,
                error: 'Profile status update failed',
                details: 'App state is not fully synchronized. Please wait a moment and try again.',
                hint: 'Make sure the instance has completed initial synchronization (usually takes 10-30 seconds after connection)',
            });
        } catch (error) {
            next(error);
        }
    }

    // Update profile picture
    async updateProfilePicture(req, res, next) {
        try {
            const { instanceId } = req.params;
            const { imageUrl, imageBase64 } = req.body;

            if (!imageUrl && !imageBase64) {
                return res.status(400).json({
                    success: false,
                    error: 'Either imageUrl or imageBase64 is required',
                });
            }

            // Get WhatsApp instance
            const instance = whatsappService.getInstance(instanceId);
            if (!instance) {
                return res.status(404).json({
                    success: false,
                    error: 'Instance not found',
                });
            }

            const { socket } = instance;
            if (!socket || !socket.user) {
                return res.status(400).json({
                    success: false,
                    error: 'WhatsApp not connected',
                });
            }

            // Check if app state is ready for profile updates
            if (!instance.appStateReady) {
                return res.status(503).json({
                    success: false,
                    error: 'Profile update not available yet',
                    details: 'App state is not fully synchronized. Please wait a moment and try again.',
                    hint: 'Make sure the instance has completed initial synchronization (usually takes 10-30 seconds after connection)',
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
                        responseType: 'arraybuffer',
                    });
                    imageBuffer = Buffer.from(response.data);
                } catch (error) {
                    return res.status(400).json({
                        success: false,
                        error: 'Failed to download image from URL',
                    });
                }
            }

            // Process image using sharp to ensure compatibility
            const sharp = require('sharp');
            try {
                imageBuffer = await sharp(imageBuffer)
                    .resize(640, 640, {
                        fit: 'cover',
                        position: 'center',
                    })
                    .jpeg({ quality: 90 })
                    .toBuffer();
            } catch (processError) {
                console.error('Image processing error:', processError);
                return res.status(400).json({
                    success: false,
                    error: 'Failed to process image',
                    details: 'Image must be a valid JPEG or PNG file',
                });
            }

            // Try to update profile picture with retry logic
            let retries = 3;
            let lastError = null;

            while (retries > 0) {
                try {
                    await socket.updateProfilePicture(socket.user.id, imageBuffer);

                    res.json({
                        success: true,
                        message: 'Profile picture updated successfully',
                    });
                    return;
                } catch (updateError) {
                    lastError = updateError;

                    // Check if it's an app state key error
                    if (updateError.message && updateError.message.includes('App state key')) {
                        console.warn(`App state key not present (attempt ${4 - retries}/3), retrying in 2 seconds...`);
                        retries--;

                        if (retries > 0) {
                            // Wait 2 seconds before retrying
                            await new Promise((resolve) => setTimeout(resolve, 2000));
                        }
                    } else {
                        // Different error, don't retry
                        throw updateError;
                    }
                }
            }

            // All retries failed
            console.error('Profile picture update failed after 3 retries:', lastError);
            return res.status(503).json({
                success: false,
                error: 'Profile picture update failed',
                details: 'App state is not fully synchronized. Please wait a moment and try again.',
                hint: 'Make sure the instance has completed initial synchronization (usually takes 10-30 seconds after connection)',
            });
        } catch (error) {
            next(error);
        }
    }

    // Delete profile picture
    async deleteProfilePicture(req, res, next) {
        try {
            const { instanceId } = req.params;

            // Get WhatsApp instance
            const instance = whatsappService.getInstance(instanceId);
            if (!instance) {
                return res.status(404).json({
                    success: false,
                    error: 'Instance not found',
                });
            }

            const sock = instance.socket;
            if (!sock || !sock.user) {
                return res.status(400).json({
                    success: false,
                    error: 'WhatsApp not connected',
                });
            }

            // Check if app state is ready for profile updates
            if (!instance.appStateReady) {
                return res.status(503).json({
                    success: false,
                    error: 'Profile update not available yet',
                    details: 'App state is not fully synchronized. Please wait a moment and try again.',
                    hint: 'Make sure the instance has completed initial synchronization (usually takes 10-30 seconds after connection)',
                });
            }

            // Try to delete profile picture with retry logic
            let retries = 3;
            let lastError = null;

            while (retries > 0) {
                try {
                    await sock.removeProfilePicture(sock.user.id);

                    res.json({
                        success: true,
                        message: 'Profile picture deleted successfully',
                    });
                    return;
                } catch (deleteError) {
                    lastError = deleteError;

                    // Check if it's an app state key error
                    if (deleteError.message && deleteError.message.includes('App state key')) {
                        console.warn(`App state key not present (attempt ${4 - retries}/3), retrying in 2 seconds...`);
                        retries--;

                        if (retries > 0) {
                            // Wait 2 seconds before retrying
                            await new Promise((resolve) => setTimeout(resolve, 2000));
                        }
                    } else {
                        // Different error, don't retry
                        throw deleteError;
                    }
                }
            }

            // All retries failed
            console.error('Profile picture deletion failed after 3 retries:', lastError);
            return res.status(503).json({
                success: false,
                error: 'Profile picture deletion failed',
                details: 'App state is not fully synchronized. Please wait a moment and try again.',
                hint: 'Make sure the instance has completed initial synchronization (usually takes 10-30 seconds after connection)',
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ProfileController();
