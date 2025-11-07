const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  apiKey: process.env.API_KEY || 'default-api-key',
  
  database: {
    url: process.env.DATABASE_URL
  },
  
  whatsapp: {
    maxReconnectAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS) || 5,
    reconnectInterval: parseInt(process.env.RECONNECT_INTERVAL) || 5000,
    sessionPath: process.env.SESSION_PATH || './sessions'
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  },
  
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  }
};
