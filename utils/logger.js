const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Define log directory
const logDir = path.join(__dirname, '../logs');

// Define log levels (using npm levels as standard: error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6)
// We'll stick to a subset for simplicity but winston uses npm levels by default.

const { combine, timestamp, json, printf, colorize, errors } = winston.format;

// Custom format for console output (readable)
const consoleFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} ${level}: ${stack || message}`;
});

// Create the logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }), // Print stack trace
        json() // Default to JSON for files
    ),
    transports: [
        // 1. Error logs - capture only errors
        new DailyRotateFile({
            dirname: logDir,
            filename: 'error-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            level: 'error',
        }),
        // 2. Application logs - capture all logs (including errors)
        new DailyRotateFile({
            dirname: logDir,
            filename: 'application-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
        }),
    ],
    // Handle uncaught exceptions and rejections
    exceptionHandlers: [
        new DailyRotateFile({
            dirname: logDir,
            filename: 'exceptions-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
        })
    ],
    rejectionHandlers: [
        new DailyRotateFile({
            dirname: logDir,
            filename: 'rejections-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
        })
    ]
});

// Use console transport for development
// In production, we might still want console logs if using a container orchestrator that scrapes stdout
// But we'll make it pretty for dev, json for prod if needed.
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: combine(
            colorize(),
            timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            consoleFormat
        ),
    }));
} else {
    // In production, also log to console (stdout) in JSON format for cloud logging agents
    logger.add(new winston.transports.Console({
        format: json(),
    }));
}

// Stream for Morgan (http logger)
logger.stream = {
    write: (message) => {
        // Morgan adds a newline, trim it
        logger.http(message.trim());
    },
};

module.exports = logger;
