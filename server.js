const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Initialize app
const app = express();

// Trust proxy for rate limiting
app.set("trust proxy", 1);

// Configure CORS for development and production
// Prefer explicit origins via CORS_ORIGIN (comma-separated) or allow all in dev
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // non-browser clients
    if (process.env.NODE_ENV === "development") return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, true); // fallback for reverse proxies
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS not allowed"));
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Security middleware
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");

app.use(helmet());
app.use(compression());

// General rate limiting - more appropriate for web applications
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for auth endpoints
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Apply general rate limiting to all routes
app.use(generalLimiter);

// Routes
app.get("/", (req, res) => {
  res.json({ message: "FinX API is running!" });
});

// Health checks
app.get("/health", (req, res) => res.status(200).send("OK"));
// API Health (for frontend connectivity checks)
app.get("/api/health", (req, res) => {
  // Lightweight JSON response, avoid DB to stay responsive
  res.status(200).json({ ok: true, time: Date.now() });
});
app.get("/ready", async (req, res) => {
  try {
    // Simple DB connection check
    const db = require("./config/db");
    await db.query("SELECT 1");
    res.status(200).send("OK");
  } catch (err) {
    res.status(503).send("Service unavailable");
  }
});

// API Routes
app.use("/api/auth", strictLimiter, require("./routes/auth"));
app.use("/api/categories", require("./routes/category"));
app.use("/api/transactions", require("./routes/transaction"));
app.use(
  "/api/recurring-transactions",
  require("./routes/recurring-transactions"),
);

app.use("/api/sources", require("./routes/source"));
app.use("/api/targets", require("./routes/target"));
app.use("/api/sharing", require("./routes/sharing"));
app.use("/api/users", require("./routes/user"));
app.use("/api/admin", require("./routes/admin"));
// Utilities for recurring testing (admin-only)
app.use("/api/recurring-tools", require("./routes/recurring-tools"));

// 404 handler for unknown routes
app.use((req, res, next) => {
  if (req.path === "/" || req.path === "/health" || req.path === "/ready")
    return next();
  res.status(404).json({ message: "Not found" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  const isDev = process.env.NODE_ENV !== "production";
  console.error(err && err.stack ? err.stack : err);
  res.status(err.status || 500).json({
    message: err.message || "Something went wrong!",
    ...(isDev ? { stack: err.stack } : {}),
  });
});

// Start background scheduler
const scheduler = require("./services/scheduler");
scheduler.start();

// Register recurring processor job to run once per day (safely scheduled)
try {
  const recurringProcessor = require("./services/recurringProcessor");
  // Schedule to run daily at 02:00 server local time (initial delay computed)
  const initialDelay = scheduler.getNextRunTime(2, 0); // ms until next 02:00
  const oneDayMs = 24 * 60 * 60 * 1000;
  scheduler.scheduleJob(
    "recurring-processor",
    recurringProcessor.processRecurringJobs,
    oneDayMs,
    initialDelay,
  );
  // In development, also run once on boot to make testing easier
  if (process.env.NODE_ENV !== "production") {
    setTimeout(() => {
      recurringProcessor
        .processRecurringJobs()
        .then((s) => console.info("Boot recurring run stats:", s))
        .catch((e) => console.error("Boot recurring run failed:", e));
    }, 2000);
  }
} catch (e) {
  console.error("Failed to register recurring processor job:", e);
}

// Start server
const PORT = process.env.PORT || 5000;
// In Docker, bind to 0.0.0.0 to be accessible from other containers
// In development, this allows the frontend to proxy API calls
const HOST = process.env.NODE_ENV === "production" ? "0.0.0.0" : "localhost";
// Run automatic DB migrations on boot, then start server
const { runAutoMigrations } = require("./utils/autoMigrate");

(async () => {
  try {
    await runAutoMigrations();
  } catch (e) {
    console.error("Automatic migrations failed:", e.message || e);
    // In production we still start to allow health endpoint visibility; schema mismatch may surface in API calls
  }
  const server = app.listen(PORT, HOST, () => {
    console.info(
      `Server is running on ${HOST}:${PORT} (${HOST === "0.0.0.0" ? "all interfaces" : "localhost only"})`,
    );
  });

  // Graceful shutdown
  function shutdown(signal) {
    console.info(`Received ${signal}. Shutting down...`);
    try {
      scheduler.stop();
    } catch (e) {
      console.error("Error stopping scheduler", e);
    }
    server.close(() => {
      console.info("HTTP server closed");
      process.exit(0);
    });
    // Force exit if not closed in time
    setTimeout(() => process.exit(1), 10000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
})();
