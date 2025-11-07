const webhookService = require('../services/webhookService');
const database = require('../config/database');

class WebhookController {
  /**
   * Test webhook URL
   */
  async testWebhook(req, res) {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'Webhook URL is required'
        });
      }

      const result = await webhookService.testWebhook(url);

      if (result.success) {
        return res.json({
          success: true,
          message: 'Webhook test successful',
          statusCode: result.statusCode,
          response: result.response
        });
      } else {
        return res.status(400).json({
          success: false,
          error: 'Webhook test failed',
          details: result.error,
          statusCode: result.statusCode
        });
      }
    } catch (error) {
      console.error('Error testing webhook:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get webhook logs
   */
  async getWebhookLogs(req, res) {
    try {
      const { instanceId, limit = 50, status } = req.query;
      const parsedLimit = parseInt(limit);

      const logs = await webhookService.getWebhookLogs(
        instanceId || null,
        parsedLimit
      );

      // Filter by status if provided
      let filteredLogs = logs;
      if (status) {
        filteredLogs = logs.filter(log => log.status === status);
      }

      return res.json({
        success: true,
        count: filteredLogs.length,
        data: filteredLogs
      });
    } catch (error) {
      console.error('Error getting webhook logs:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get webhook log by ID
   */
  async getWebhookLog(req, res) {
    try {
      const { webhookId } = req.params;

      if (!webhookId) {
        return res.status(400).json({
          success: false,
          error: 'Webhook ID is required'
        });
      }

      const log = await webhookService.getWebhookLogById(webhookId);

      if (!log) {
        return res.status(404).json({
          success: false,
          error: 'Webhook log not found'
        });
      }

      return res.json({
        success: true,
        data: log
      });
    } catch (error) {
      console.error('Error getting webhook log:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Retry failed webhook
   */
  async retryWebhook(req, res) {
    try {
      const { webhookId } = req.params;

      if (!webhookId) {
        return res.status(400).json({
          success: false,
          error: 'Webhook ID is required'
        });
      }

      const log = await webhookService.getWebhookLogById(webhookId);

      if (!log || log.status === 'success') {
        return res.status(400).json({
          success: false,
          error: 'Invalid webhook ID or already successful'
        });
      }

      // Get the original payload from log
      const payload = JSON.parse(log.payload);
      const instance = await database.getInstance().instance.findUnique({
        where: { id: log.instanceId }
      });

      if (!instance?.webhookUrl) {
        return res.status(400).json({
          success: false,
          error: 'Instance webhook URL not found'
        });
      }

      // Trigger retry
      const result = await webhookService.triggerWebhook(
        instance.webhookUrl,
        payload,
        log.instanceId
      );

      return res.json({
        success: true,
        message: 'Webhook retry initiated',
        webhookId,
        result
      });
    } catch (error) {
      console.error('Error retrying webhook:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(req, res) {
    try {
      const { instanceId, days = 7 } = req.query;
      const prisma = database.getInstance();

      const where = instanceId ? { instanceId } : {};
      const dateFilter = {
        createdAt: {
          gte: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)
        }
      };

      const [total, success, failed, events] = await Promise.all([
        prisma.webhookLog.count({ where: { ...where, ...dateFilter } }),
        prisma.webhookLog.count({ 
          where: { ...where, ...dateFilter, status: 'success' } 
        }),
        prisma.webhookLog.count({ 
          where: { ...where, ...dateFilter, status: 'failed' } 
        }),
        prisma.webhookLog.groupBy({
          by: ['event'],
          where: { ...where, ...dateFilter },
          _count: { event: true },
          orderBy: { _count: { event: 'desc' } }
        })
      ]);

      return res.json({
        success: true,
        data: {
          period: `${days} days`,
          total,
          success,
          failed,
          successRate: total > 0 ? ((success / total) * 100).toFixed(2) : 0,
          topEvents: events,
          instanceId: instanceId || 'all'
        }
      });
    } catch (error) {
      console.error('Error getting webhook stats:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Clear webhook logs
   */
  async clearWebhookLogs(req, res) {
    try {
      const { instanceId, days } = req.body;
      const prisma = database.getInstance();

      let where = {};
      if (instanceId) {
        where.instanceId = instanceId;
      }
      if (days) {
        where.createdAt = {
          lte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        };
      }

      const deleted = await prisma.webhookLog.deleteMany({
        where
      });

      return res.json({
        success: true,
        message: 'Webhook logs cleared',
        deletedCount: deleted.count
      });
    } catch (error) {
      console.error('Error clearing webhook logs:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

module.exports = new WebhookController();
