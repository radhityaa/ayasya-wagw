const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const config = require('./config/config.js');
const errorHandler = require('./middleware/errorHandler.js');
const { generalLimiter } = require('./middleware/rateLimiter.js');

// Import routes
const instanceRoutes = require('./routes/instanceRoutes.js');
const messageRoutes = require('./routes/messageRoutes.js');
const authRoutes = require('./routes/authRoutes.js');
const profileRoutes = require('./routes/profileRoutes.js');
const advancedMessageRoutes = require('./routes/advancedMessageRoutes.js');
const channelRoutes = require('./routes/channelRoutes.js');
const webhookRoutes = require('./routes/webhookRoutes.js');
const groupRoutes = require('./routes/groupRoutes.js');
const statusRoutes = require('./routes/statusRoutes.js');
const contactRoutes = require('./routes/contactRoutes.js');
const presenceRoutes = require('./routes/presenceRoutes.js');
const eventRoutes = require('./routes/eventRoutes.js');
const labelRoutes = require('./routes/labelRoutes.js');
const mediaRoutes = require('./routes/mediaRoutes.js');
const observabilityRoutes = require('./routes/observabilityRoutes.js');
const chatRoutes = require('./routes/chatRoutes.js');

// Create Express app
const app = express();

// Middleware
app.use(cors(config.cors));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Apply general rate limiting to all routes
app.use(generalLimiter);

// Serve static files for QR codes
app.use('/public', express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
    environment: config.env
  });
});


// API routes
app.use('/api/instance', instanceRoutes);
app.use('/api/message', messageRoutes);
app.use('/api/message', advancedMessageRoutes); // Merged under /api/message
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/presence', presenceRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/labels', labelRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/observability', observabilityRoutes);
app.use('/api/chats', chatRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

module.exports = app;
