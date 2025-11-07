const config = require('../config/config');
const database = require('../config/database');
const crypto = require('crypto');

class AuthController {
  async validateApiKey(req, res, next) {
    try {
      const apiKey = req.headers['x-api-key'] || req.query.apiKey;
      
      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: 'API key is required'
        });
      }
      
      // In production, you should validate against database
      if (apiKey !== config.apiKey) {
        return res.status(401).json({
          success: false,
          error: 'Invalid API key'
        });
      }
      
      next();
    } catch (error) {
      console.error('Error validating API key:', error);
      res.status(500).json({
        success: false,
        error: 'Authentication failed'
      });
    }
  }

  async generateApiKey(req, res) {
    try {
      const { name, permissions = ['read', 'write'] } = req.body;
      
      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Name is required'
        });
      }
      
      // Generate a random API key
      const apiKey = crypto.randomBytes(32).toString('hex');
      
      // In production, save this to database
      // For now, just return it
      res.json({
        success: true,
        data: {
          name,
          apiKey,
          permissions,
          createdAt: new Date()
        },
        message: 'API key generated successfully. Please save it securely.'
      });
    } catch (error) {
      console.error('Error generating API key:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate API key'
      });
    }
  }

  async validateWebhook(req, res) {
    try {
      const { instanceId, webhookUrl } = req.body;
      
      if (!instanceId || !webhookUrl) {
        return res.status(400).json({
          success: false,
          error: 'instanceId and webhookUrl are required'
        });
      }
      
      // Send test webhook
      const testPayload = {
        event: 'webhook.test',
        instanceId,
        timestamp: new Date(),
        data: {
          message: 'This is a test webhook'
        }
      };
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': 'test'
        },
        body: JSON.stringify(testPayload)
      });
      
      if (response.ok) {
        res.json({
          success: true,
          message: 'Webhook validated successfully',
          statusCode: response.status
        });
      } else {
        res.status(400).json({
          success: false,
          error: `Webhook validation failed with status ${response.status}`
        });
      }
    } catch (error) {
      console.error('Error validating webhook:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to validate webhook'
      });
    }
  }

  async getWebhookEvents(req, res) {
    try {
      const { instanceId } = req.params;
      const { status = 'all', limit = 50, offset = 0 } = req.query;
      
      const prisma = database.getInstance();
      
      const where = {};
      
      if (instanceId) {
        where.instanceId = instanceId;
      }
      
      if (status !== 'all') {
        where.status = status;
      }
      
      const webhooks = await prisma.webhook.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        },
        take: parseInt(limit),
        skip: parseInt(offset)
      });
      
      const total = await prisma.webhook.count({ where });
      
      res.json({
        success: true,
        data: webhooks,
        count: webhooks.length,
        total,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + webhooks.length < total
        }
      });
    } catch (error) {
      console.error('Error getting webhook events:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get webhook events'
      });
    }
  }

  async retryWebhook(req, res) {
    try {
      const { webhookId } = req.params;
      
      const prisma = database.getInstance();
      
      const webhook = await prisma.webhook.findUnique({
        where: { id: webhookId }
      });
      
      if (!webhook) {
        return res.status(404).json({
          success: false,
          error: 'Webhook not found'
        });
      }
      
      // Get instance to find webhook URL
      const instance = await prisma.instance.findUnique({
        where: { id: webhook.instanceId }
      });
      
      if (!instance || !instance.webhookUrl) {
        return res.status(400).json({
          success: false,
          error: 'Instance or webhook URL not found'
        });
      }
      
      // Retry webhook
      try {
        const response = await fetch(instance.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Event': webhook.event,
            'X-Webhook-Retry': 'true'
          },
          body: webhook.payload
        });
        
        if (response.ok) {
          await prisma.webhook.update({
            where: { id: webhookId },
            data: {
              status: 'sent',
              attempts: { increment: 1 },
              lastAttempt: new Date()
            }
          });
          
          res.json({
            success: true,
            message: 'Webhook retry successful'
          });
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        await prisma.webhook.update({
          where: { id: webhookId },
          data: {
            status: 'failed',
            attempts: { increment: 1 },
            lastAttempt: new Date()
          }
        });
        
        res.status(500).json({
          success: false,
          error: `Webhook retry failed: ${error.message}`
        });
      }
    } catch (error) {
      console.error('Error retrying webhook:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to retry webhook'
      });
    }
  }
}

module.exports = new AuthController();
