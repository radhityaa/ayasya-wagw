const os = require('os');
const process = require('process');
const whatsappService = require('../services/whatsappService');

// Helper function to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Observability Controller
 * 
 * Provides server monitoring and management endpoints:
 * - Ping: Check if server is responsive
 * - Health: Detailed health check
 * - Version: Get server version info
 * - Environment: Get server environment details
 * - Status: Get comprehensive server status
 * - Stop: Gracefully stop the server
 * - Restart: Restart the server
 */
class ObservabilityController {
  // Ping server - simple alive check
  async ping(req, res) {
    try {
      res.json({
        success: true,
        message: 'pong',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to ping server',
        details: error.message
      });
    }
  }

  // Health check - detailed health information
  async healthCheck(req, res) {
    try {
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();
      
      // Check database connection
      let databaseStatus = 'unknown';
      try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        await prisma.$connect();
        databaseStatus = 'connected';
        await prisma.$disconnect();
      } catch (error) {
        databaseStatus = 'disconnected';
      }

      // Get active instances count
      const instances = whatsappService.getAllInstances();
      const activeInstances = Object.values(instances).filter(
        instance => instance.socket && instance.status === 'connected'
      ).length;

      const health = {
        status: 'healthy',
        uptime: {
          seconds: Math.floor(uptime),
          formatted: formatUptime(uptime)
        },
        memory: {
          rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
          heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
          heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`
        },
        database: {
          status: databaseStatus
        },
        instances: {
          total: Object.keys(instances).length,
          active: activeInstances
        },
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Health check failed',
        details: error.message
      });
    }
  }

  // Get server version
  async getVersion(req, res) {
    try {
      const packageJson = require('../../package.json');
      
      res.json({
        success: true,
        data: {
          name: packageJson.name || 'WhatsApp Gateway API',
          version: packageJson.version || '1.0.0',
          description: packageJson.description || 'Multi-instance WhatsApp Gateway API',
          node: process.version,
          platform: process.platform,
          arch: process.arch
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get version',
        details: error.message
      });
    }
  }

  // Get server environment
  async getEnvironment(req, res) {
    try {
      const config = require('../config/config');
      
      res.json({
        success: true,
        data: {
          environment: config.env || process.env.NODE_ENV || 'development',
          port: config.port || process.env.PORT || 3000,
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          hostname: os.hostname(),
          cpus: os.cpus().length,
          totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
          freeMemory: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
          uptime: {
            system: `${(os.uptime() / 3600).toFixed(2)} hours`,
            process: `${(process.uptime() / 3600).toFixed(2)} hours`
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get environment',
        details: error.message
      });
    }
  }

  // Get comprehensive server status
  async getStatus(req, res) {
    try {
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // Get all instances status
      const instances = whatsappService.getAllInstances();
      const instancesStatus = Object.entries(instances).map(([id, instance]) => ({
        id,
        status: instance.status || 'unknown',
        connected: instance.socket ? true : false
      }));

      const status = {
        server: {
          status: 'running',
          uptime: {
            seconds: Math.floor(uptime),
            formatted: formatUptime(uptime)
          },
          startTime: new Date(Date.now() - uptime * 1000).toISOString()
        },
        system: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          hostname: os.hostname(),
          cpus: os.cpus().length,
          loadAverage: os.loadavg()
        },
        memory: {
          system: {
            total: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
            free: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
            used: `${((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024).toFixed(2)} GB`,
            usagePercent: `${(((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(2)}%`
          },
          process: {
            rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
            heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
            heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
            external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`
          }
        },
        cpu: {
          user: `${(cpuUsage.user / 1000000).toFixed(2)} seconds`,
          system: `${(cpuUsage.system / 1000000).toFixed(2)} seconds`
        },
        instances: {
          total: instancesStatus.length,
          connected: instancesStatus.filter(i => i.connected).length,
          disconnected: instancesStatus.filter(i => !i.connected).length,
          list: instancesStatus
        },
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get status',
        details: error.message
      });
    }
  }

  // Stop server gracefully
  async stopServer(req, res) {
    try {
      res.json({
        success: true,
        message: 'Server is shutting down gracefully...',
        timestamp: new Date().toISOString()
      });

      // Give time for response to be sent
      setTimeout(() => {
        console.log('Server shutdown requested via API');
        process.exit(0);
      }, 1000);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to stop server',
        details: error.message
      });
    }
  }

  // Restart server
  async restartServer(req, res) {
    try {
      res.json({
        success: true,
        message: 'Server is restarting...',
        note: 'This requires a process manager like PM2 or nodemon to automatically restart',
        timestamp: new Date().toISOString()
      });

      // Give time for response to be sent
      setTimeout(() => {
        console.log('Server restart requested via API');
        process.exit(1); // Exit with error code to trigger restart by process manager
      }, 1000);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to restart server',
        details: error.message
      });
    }
  }

}

module.exports = new ObservabilityController();
