const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const logger = require("./utils/logger"); // Import Logger
const morgan = require("morgan"); // Import Morgan

// Load environment variables
dotenv.config();

// Initialize app
const app = express();
// Remove X-Powered-By header explicitly
app.disable("x-powered-by");

// Require JWT secret at startup (warn/fail in production)
if (!process.env.JWT_SECRET) {
  const msg = "JWT_SECRET is not set. Set a strong secret in environment.";
  if (process.env.NODE_ENV === "production") {
    logger.error(msg);
    process.exit(1);
  } else {
    logger.warn(msg);
  }
}

// Trust proxy for rate limiting
app.set("trust proxy", 1);

// Configure CORS
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV === "development") return callback(null, true);
    if (allowedOrigins.length === 0) return callback(new Error("CORS not allowed"));
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS not allowed"));
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

// Middleware
app.use(cors(corsOptions));
// Use Morgan for HTTP logging, stream to Winston
const morganFormat = process.env.NODE_ENV === "production" ? "combined" : "dev";
app.use(morgan(morganFormat, { stream: logger.stream }));

app.use(express.json());

// Security middleware
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "img-src": ["'self'", "data:", "blob:"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "frame-ancestors": ["'none'"],
      },
    },
    referrerPolicy: { policy: "no-referrer" },
  }),
);

app.use((req, res, next) => {
  res.vary("Origin");
  next();
});

app.use(
  compression({
    filter: (req, res) => {
      if (req.path === "/api/events") return false;
      const accept = req.headers["accept"] || "";
      if (accept.includes("text/event-stream")) return false;
      return compression.filter(req, res);
    },
  }),
);

// ============================================================================
// Rate Limiting Configuration
// Tiered approach for personal finance app with mobile sync support
// Auth-specific limiters are defined in routes/auth.js per-endpoint
// ============================================================================

// General API limiter - generous for data sync operations
// Finance apps may fetch transactions, categories, sources, targets, goals, etc.
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  limit: 120, // 120 requests per minute (2 req/sec sustained)
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a moment before trying again." },
});

// Transaction/write limiter - slightly stricter for write operations
// Prevents accidental or malicious flooding of transaction/recurring creation
const transactionWriteLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  limit: 60, // 60 writes per minute (1 per second sustained)
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many write operations. Please slow down." },
});

// Apply general limiter to all routes
app.use(generalLimiter);

// Routes
app.get("/", (req, res) => {
  res.json({ message: "FinX API is running!" });
});

app.get("/health", (req, res) => res.status(200).send("OK"));
app.get("/api/health", (req, res) => {
  res.status(200).json({ ok: true, time: Date.now() });
});
app.get("/ready", async (req, res) => {
  try {
    const db = require("./config/db");
    await db.query("SELECT 1");
    res.status(200).send("OK");
  } catch (err) {
    logger.error("Readiness check failed: " + err.message);
    res.status(503).send("Service unavailable");
  }
});

// API Routes
// Auth routes need separate handling - some endpoints are sensitive, others less so
const authRouter = require("./routes/auth");
app.use("/api/auth", authRouter);
app.use("/api/categories", require("./routes/category"));
app.use("/api/transactions", transactionWriteLimiter, require("./routes/transaction"));
app.use("/api/recurring-transactions", transactionWriteLimiter, require("./routes/recurring-transactions"));
app.use("/api/sources", require("./routes/source"));
app.use("/api/targets", require("./routes/target"));
app.use("/api/sharing", require("./routes/sharing"));
app.use("/api/users", require("./routes/user"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/goals", require("./routes/goal"));
app.use("/api/recurring-tools", require("./routes/recurring-tools"));

// SSE events
const authSSE = require("./middleware/authSSE");
const { createEventBroadcaster } = require("./utils/sse");
const sse = createEventBroadcaster();

app.get("/api/events", authSSE, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.flushHeaders && res.flushHeaders();

  const userId = req.user?.id;
  const client = sse.addClient(res, userId);
  sse.send(client, { type: "hello", time: Date.now() });

  req.on("close", () => {
    sse.removeClient(client.id);
  });
});

// 404 handler
app.use((req, res, next) => {
  if (req.path === "/" || req.path === "/health" || req.path === "/ready")
    return next();
  res.status(404).json({ message: "Not found" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  const isDev = process.env.NODE_ENV !== "production";
  logger.error(err.message, { stack: err.stack, path: req.path, method: req.method });
  res.status(err.status || 500).json({
    message: err.message || "Something went wrong!",
    ...(isDev ? { stack: err.stack } : {}),
  });
});

// Start background scheduler
const scheduler = require("./services/scheduler");
scheduler.start();

// Recurring Processor
try {
  const recurringProcessor = require("./services/recurringProcessor");
  const initialDelay = scheduler.getNextRunTime(2, 0);
  const oneDayMs = 24 * 60 * 60 * 1000;
  scheduler.scheduleJob(
    "recurring-processor",
    () => recurringProcessor.processRecurringJobs(app),
    oneDayMs,
    initialDelay,
  );
  if (process.env.NODE_ENV !== "production") {
    setTimeout(() => {
      recurringProcessor
        .processRecurringJobs(app)
        .then((s) => logger.info("Boot recurring run stats: " + JSON.stringify(s)))
        .catch((e) => logger.error("Boot recurring run failed", e));
    }, 2000);
  }
} catch (e) {
  logger.error("Failed to register recurring processor job", e);
}

// Start server
const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0"; // Bind to all interfaces to allow mobile access
const { runAutoMigrations } = require("./utils/autoMigrate");

(async () => {
  try {
    await runAutoMigrations();
  } catch (e) {
    logger.error("Automatic migrations failed: " + e.message);
  }
  const server = app.listen(PORT, HOST, () => {
    logger.info(`Server is running on ${HOST}:${PORT} (${HOST === "0.0.0.0" ? "all interfaces" : "localhost only"})`);
  });

  app.set("sse", sse);

  function shutdown(signal) {
    logger.info(`Received ${signal}. Shutting down...`);
    try {
      scheduler.stop();
    } catch (e) {
      logger.error("Error stopping scheduler", e);
    }
    server.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
})();
