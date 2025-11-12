const { prisma } = require('../config/database');
const sessionManager = require('../services/sessionManager');
const whatsappService = require('../services/whatsappService');

class InstanceController {
    async create(req, res) {
        try {
            const { name, id, webhookUrl, phoneNumber } = req.body;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    error: 'Instance name is required',
                });
            }

            if (!phoneNumber) {
                return res.status(400).json({
                    success: false,
                    error: 'Phone number is required',
                });
            }

            const instance = await sessionManager.createInstance({
                id,
                name,
                webhookUrl,
                phoneNumber,
            });

            res.status(201).json({
                success: true,
                data: instance,
                message: 'Instance created successfully. Use /qr or /pairing-code endpoints to authenticate.',
            });
        } catch (error) {
            console.error('Error creating instance:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to create instance',
            });
        }
    }

    async delete(req, res) {
        try {
            const { instanceId } = req.params;

            const result = await sessionManager.deleteInstance(instanceId);

            res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            console.error('Error deleting instance:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to delete instance',
            });
        }
    }

    async getStatus(req, res) {
        try {
            const { instanceId } = req.params;

            const instance = await sessionManager.getInstance(instanceId);

            res.json({
                success: true,
                data: {
                    id: instance.id,
                    name: instance.name,
                    status: instance.status,
                    phoneNumber: instance.phoneNumber,
                    isActive: instance.isActive,
                    messageCount: instance._count?.messages || 0,
                    chatCount: instance._count?.chats || 0,
                    createdAt: instance.createdAt,
                    updatedAt: instance.updatedAt,
                },
            });
        } catch (error) {
            console.error('Error getting instance status:', error);
            res.status(404).json({
                success: false,
                error: error.message || 'Instance not found',
            });
        }
    }

    async getQR(req, res) {
        try {
            const { instanceId } = req.params;

            const qrCode = await sessionManager.getInstanceQR(instanceId);

            res.json({
                success: true,
                data: {
                    qrCode,
                    message: 'Scan this QR code with WhatsApp',
                },
            });
        } catch (error) {
            console.error('Error getting QR code:', error);
            res.status(404).json({
                success: false,
                error: error.message || 'QR code not available',
            });
        }
    }

    async requestPairingCode(req, res) {
        try {
            const { instanceId } = req.params;
            const { phoneNumber } = req.body;

            if (!phoneNumber) {
                return res.status(400).json({
                    success: false,
                    error: 'Phone number is required',
                });
            }

            const pairingCode = await whatsappService.requestPairingCode(instanceId, phoneNumber);

            res.json({
                success: true,
                data: {
                    pairingCode,
                    message: 'Pairing code generated successfully. Enter this code in WhatsApp.',
                },
            });
        } catch (error) {
            console.error('Error requesting pairing code:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to request pairing code',
            });
        }
    }

    async getPairingCode(req, res) {
        try {
            const { instanceId } = req.params;

            const pairingCode = whatsappService.getPairingCode(instanceId);

            if (!pairingCode) {
                return res.status(404).json({
                    success: false,
                    error: 'Pairing code not available',
                });
            }

            res.json({
                success: true,
                data: {
                    pairingCode,
                    message: 'Current pairing code',
                },
            });
        } catch (error) {
            console.error('Error getting pairing code:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to get pairing code',
            });
        }
    }

    async getAll(req, res) {
        try {
            const instances = await sessionManager.getAllInstances();

            res.json({
                success: true,
                data: instances,
                count: instances.length,
            });
        } catch (error) {
            console.error('Error getting all instances:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to get instances',
            });
        }
    }

    async update(req, res) {
        try {
            const { instanceId } = req.params;
            const { name, webhookUrl } = req.body;

            const instance = await sessionManager.updateInstance(instanceId, {
                name,
                webhookUrl,
            });

            res.json({
                success: true,
                data: instance,
                message: 'Instance updated successfully',
            });
        } catch (error) {
            console.error('Error updating instance:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to update instance',
            });
        }
    }

    async restart(req, res) {
        try {
            const { instanceId } = req.params;

            // Delete existing connection
            await whatsappService.deleteInstance(instanceId);

            // Wait a moment
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Reinitialize
            await whatsappService.init(instanceId);

            res.json({
                success: true,
                message: 'Instance restarted successfully',
            });
        } catch (error) {
            console.error('Error restarting instance:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to restart instance',
            });
        }
    }

    async logout(req, res) {
        try {
            const { instanceId } = req.params;

            const instance = whatsappService.getInstance(instanceId);

            if (!instance || !instance.socket) {
                return res.status(404).json({
                    success: false,
                    error: 'Instance not found or not connected',
                });
            }

            await instance.socket.logout();

            res.json({
                success: true,
                message: 'Logged out successfully',
            });
        } catch (error) {
            console.error('Error logging out:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to logout',
            });
        }
    }

    async getInfo(req, res) {
        try {
            const { instanceId } = req.params;

            const info = await sessionManager.getInstanceInfo(instanceId);

            res.json({
                success: true,
                data: info,
            });
        } catch (error) {
            console.error('Error getting instance info:', error);
            res.status(404).json({
                success: false,
                error: error.message || 'Instance info not available',
            });
        }
    }
}

module.exports = new InstanceController();
