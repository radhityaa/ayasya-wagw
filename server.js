const app = require('./src/app.js');
const config = require('./src/config/config.js');
const database = require('./src/config/database.js');
const sessionManager = require('./src/services/sessionManager.js');

// Global server variable
let server;

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  
  if (server) {
    server.close(() => {
      console.log('Server closed');
    });
  }
  
  await database.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  
  if (server) {
    server.close(() => {
      console.log('Server closed');
    });
  }
  
  await database.disconnect();
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    console.log('🚀 Starting WhatsApp Gateway API...');
    
    // Connect to database
    await database.connect();
    
    // Initialize all saved sessions
    await sessionManager.initializeAllSessions();
    
    // Start Express server
    server = app.listen(config.port, () => {
      console.log(`✅ Server is running on port ${config.port}`);
      console.log(`📍 Environment: ${config.env}`);
      console.log(`🔗 API URL: http://localhost:${config.port}`);
      console.log(`🔑 API Key required: Yes (use X-API-Key header)`);
      console.log('\n📚 API Documentation: http://localhost:' + config.port);
      console.log('\n========================================');
      console.log('WhatsApp Gateway API is ready to use!');
      console.log('========================================\n');
    });
    
    return server;
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Export for testing
module.exports = server;
