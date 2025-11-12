const path = require('path');
const winston = require('winston');

const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for logs
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'DD-MM-YYYY HH:mm:ss',
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.prettyPrint(),
);

// Create winston logger
const logger = winston.createLogger({
    levels: logLevels,
    format: logFormat,
    transports: [
        // Console transport
        new winston.transports.Console({
            level: 'debug',
            format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
        }),
        // File Transport for all logs
        new winston.transports.File({
            filename: path.join(logsDir, 'app.log'),
            level: 'info',
            maxsize: 5242880, // 5MB
            maxFiles: 10,
            format: logFormat,
        }),
        // File transport for error logs
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 10,
            format: logFormat,
        }),
    ],
});

// Function to get all logs for API endpoint
const getAllLogs = (limit = 100) => {
    const allLogsPath = path.join(logsDir, 'app.log');

    try {
        if (fs.existsSync(allLogsPath)) {
            const logData = fs.readFileSync(allLogsPath, 'utf8');
            const logs = logData
                .split('\n')
                .filter((line) => line.trim() !== '')
                .map((line) => {
                    try {
                        return JSON.parse(line);
                    } catch (e) {
                        return { message: line, timestamp: new Date().toISOString() };
                    }
                })
                .slice(-limit)
                .reverse();

            return logs;
        }
        return [];
    } catch (error) {
        logger.error('Error reading logs:', error);
        return [];
    }
};

// Create a logger wrapper that properly handles Baileys requirements
class LoggerWrapper {
    constructor(winstonLogger) {
        this.logger = winstonLogger;
    }

    info(message, ...args) {
        this.logger.info(message, ...args);
    }

    error(message, ...args) {
        this.logger.error(message, ...args);
    }

    warn(message, ...args) {
        this.logger.warn(message, ...args);
    }

    debug(message, ...args) {
        this.logger.debug(message, ...args);
    }

    trace(message, ...args) {
        // Map trace to debug since winston doesn't have trace by default
        this.logger.debug(message, ...args);
    }

    child(options) {
        // Return a new wrapper with the child logger
        return new LoggerWrapper(this.logger.child(options));
    }
}

const loggerWrapper = new LoggerWrapper(logger);

module.exports = {
    info: loggerWrapper.info.bind(loggerWrapper),
    error: loggerWrapper.error.bind(loggerWrapper),
    warn: loggerWrapper.warn.bind(loggerWrapper),
    debug: loggerWrapper.debug.bind(loggerWrapper),
    trace: loggerWrapper.trace.bind(loggerWrapper),
    child: loggerWrapper.child.bind(loggerWrapper),
    getAllLogs,
};
