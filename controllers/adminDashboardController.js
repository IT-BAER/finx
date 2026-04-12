const db = require("../config/db");
const logger = require("../utils/logger");
const os = require("os");
const fs = require("fs");
const path = require("path");

// ─── Enhanced System Stats ────────────────────────────────────────────
const getDashboardStats = async (req, res) => {
  try {
    const [
      usersResult,
      transactionsResult,
      categoriesResult,
      sourcesResult,
      targetsResult,
      goalsResult,
      recurringResult,
      recentUsersResult,
      activeUsersResult,
      dbSizeResult,
    ] = await Promise.all([
      db.query("SELECT COUNT(*) FROM users"),
      db.query("SELECT COUNT(*) FROM transactions"),
      db.query("SELECT COUNT(*) FROM categories"),
      db.query("SELECT COUNT(*) FROM sources"),
      db.query("SELECT COUNT(*) FROM targets"),
      db.query("SELECT COUNT(*) FROM goals"),
      db.query("SELECT COUNT(*) FROM recurring_transactions"),
      db.query(
        "SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '30 days'"
      ),
      db.query(
        "SELECT COUNT(*) FROM users WHERE last_login >= NOW() - INTERVAL '7 days'"
      ),
      db.query("SELECT pg_database_size(current_database()) AS size"),
    ]);

    res.json({
      success: true,
      stats: {
        users: parseInt(usersResult.rows[0].count),
        transactions: parseInt(transactionsResult.rows[0].count),
        categories: parseInt(categoriesResult.rows[0].count),
        sources: parseInt(sourcesResult.rows[0].count),
        targets: parseInt(targetsResult.rows[0].count),
        goals: parseInt(goalsResult.rows[0].count),
        recurringTransactions: parseInt(recurringResult.rows[0].count),
        newUsersLast30Days: parseInt(recentUsersResult.rows[0].count),
        activeUsersLast7Days: parseInt(activeUsersResult.rows[0].count),
        databaseSizeBytes: parseInt(dbSizeResult.rows[0].size),
      },
    });
  } catch (err) {
    logger.error("[AdminDashboard] getDashboardStats error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── User List with Subscription & Activity ───────────────────────────
const getUsersOverview = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.is_admin,
        u.created_at,
        u.last_login,
        (SELECT COUNT(*) FROM transactions WHERE user_id = u.id) AS transaction_count,
        (SELECT COUNT(*) FROM goals WHERE user_id = u.id) AS goal_count,
        (SELECT COUNT(*) FROM recurring_transactions WHERE user_id = u.id) AS recurring_count,
        (SELECT COUNT(*) FROM simplefin_connections WHERE user_id = u.id) AS simplefin_connections
      FROM users u
      ORDER BY u.created_at DESC
    `);

    // Enrich with RevenueCat subscription status if API key is set
    const apiKey = process.env.REVENUECAT_API_KEY;
    const entitlementId = process.env.REVENUECAT_ENTITLEMENT_ID || "FinX Pro";
    const users = [];

    for (const row of result.rows) {
      const user = {
        id: row.id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        isAdmin: row.is_admin,
        createdAt: row.created_at,
        lastLogin: row.last_login,
        transactionCount: parseInt(row.transaction_count),
        goalCount: parseInt(row.goal_count),
        recurringCount: parseInt(row.recurring_count),
        simplefinConnections: parseInt(row.simplefin_connections),
        subscription: null,
      };

      if (apiKey) {
        try {
          const response = await fetch(
            `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(String(row.id))}`,
            {
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
            }
          );
          if (response.ok) {
            const data = await response.json();
            const ent = data?.subscriber?.entitlements?.[entitlementId];
            if (ent) {
              user.subscription = {
                active:
                  ent.expires_date === null ||
                  new Date(ent.expires_date) > new Date(),
                expiresDate: ent.expires_date,
                productIdentifier: ent.product_identifier,
                purchaseDate: ent.purchase_date,
              };
            }
          }
        } catch {
          // Non-critical — leave subscription as null
        }
      }

      users.push(user);
    }

    res.json({ success: true, users });
  } catch (err) {
    logger.error("[AdminDashboard] getUsersOverview error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── Server Health ────────────────────────────────────────────────────
const getServerHealth = async (req, res) => {
  try {
    const [dbConnResult, dbUptimeResult, tableStatsResult] = await Promise.all([
      db.query(
        "SELECT count(*) AS active FROM pg_stat_activity WHERE state = 'active'"
      ),
      db.query("SELECT pg_postmaster_start_time() AS started_at"),
      db.query(`
        SELECT relname AS table_name,
               n_live_tup AS row_count
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
        LIMIT 10
      `),
    ]);

    const uptimeSeconds = process.uptime();
    const memUsage = process.memoryUsage();

    res.json({
      success: true,
      health: {
        server: {
          uptimeSeconds: Math.floor(uptimeSeconds),
          nodeVersion: process.version,
          platform: os.platform(),
          arch: os.arch(),
          hostname: os.hostname(),
          totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
          freeMemoryMB: Math.round(os.freemem() / 1024 / 1024),
          cpuCount: os.cpus().length,
          loadAvg: os.loadavg(),
        },
        process: {
          memoryRSS_MB: Math.round(memUsage.rss / 1024 / 1024),
          memoryHeapUsed_MB: Math.round(memUsage.heapUsed / 1024 / 1024),
          memoryHeapTotal_MB: Math.round(memUsage.heapTotal / 1024 / 1024),
          pid: process.pid,
        },
        database: {
          activeConnections: parseInt(dbConnResult.rows[0].active),
          startedAt: dbUptimeResult.rows[0].started_at,
          topTables: tableStatsResult.rows.map((r) => ({
            table: r.table_name,
            rows: parseInt(r.row_count),
          })),
        },
      },
    });
  } catch (err) {
    logger.error("[AdminDashboard] getServerHealth error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── Audit Logs ───────────────────────────────────────────────────────
const getAuditLogs = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const action = req.query.action || null;

    let query = `
      SELECT id, user_id, email, action, details, ip_address, user_agent, success, created_at
      FROM audit_log
    `;
    const params = [];

    if (action) {
      params.push(action);
      query += ` WHERE action = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC`;
    params.push(limit);
    query += ` LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const [logsResult, countResult] = await Promise.all([
      db.query(query, params),
      db.query(
        action
          ? "SELECT COUNT(*) FROM audit_log WHERE action = $1"
          : "SELECT COUNT(*) FROM audit_log",
        action ? [action] : []
      ),
    ]);

    res.json({
      success: true,
      logs: logsResult.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset,
    });
  } catch (err) {
    logger.error("[AdminDashboard] getAuditLogs error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── Error Logs (from filesystem) ─────────────────────────────────────
const getErrorLogs = async (req, res) => {
  try {
    const logDir = path.join(__dirname, "../logs");
    const lines = Math.min(parseInt(req.query.lines) || 100, 500);

    // Find today's error log file
    const today = new Date().toISOString().split("T")[0];
    const errorLogFile = path.join(logDir, `error-${today}.log`);

    let entries = [];

    if (fs.existsSync(errorLogFile)) {
      const content = fs.readFileSync(errorLogFile, "utf-8");
      const allLines = content.trim().split("\n").filter(Boolean);
      const recentLines = allLines.slice(-lines);

      for (const line of recentLines) {
        try {
          entries.push(JSON.parse(line));
        } catch {
          entries.push({ message: line, level: "error" });
        }
      }
    }

    // Also list available log files for the dropdown
    let availableFiles = [];
    if (fs.existsSync(logDir)) {
      availableFiles = fs
        .readdirSync(logDir)
        .filter((f) => f.endsWith(".log"))
        .sort()
        .reverse()
        .slice(0, 30);
    }

    res.json({
      success: true,
      entries,
      currentFile: `error-${today}.log`,
      availableFiles,
    });
  } catch (err) {
    logger.error("[AdminDashboard] getErrorLogs error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── Activity Overview (transactions per day, last 30 days) ───────────
const getActivityOverview = async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 90);

    const [txPerDay, txPerUser, topCategories] = await Promise.all([
      db.query(
        `SELECT date_trunc('day', date)::date AS day, COUNT(*) AS count
         FROM transactions
         WHERE date >= NOW() - make_interval(days => $1)
         GROUP BY day
         ORDER BY day`,
        [days]
      ),
      db.query(
        `SELECT u.id, u.email, u.first_name, u.last_name, COUNT(t.id) AS count
         FROM users u
         LEFT JOIN transactions t ON t.user_id = u.id
           AND t.date >= NOW() - make_interval(days => $1)
         GROUP BY u.id, u.email, u.first_name, u.last_name
         ORDER BY count DESC
         LIMIT 10`,
        [days]
      ),
      db.query(
        `SELECT c.name, COUNT(t.id) AS count
         FROM transactions t
         JOIN categories c ON t.category_id = c.id
         WHERE t.date >= NOW() - make_interval(days => $1)
         GROUP BY c.name
         ORDER BY count DESC
         LIMIT 10`,
        [days]
      ),
    ]);

    res.json({
      success: true,
      activity: {
        transactionsPerDay: txPerDay.rows.map((r) => ({
          day: r.day,
          count: parseInt(r.count),
        })),
        topUsersByTransactions: txPerUser.rows.map((r) => ({
          id: r.id,
          email: r.email,
          name: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email,
          count: parseInt(r.count),
        })),
        topCategories: topCategories.rows.map((r) => ({
          name: r.name,
          count: parseInt(r.count),
        })),
      },
    });
  } catch (err) {
    logger.error("[AdminDashboard] getActivityOverview error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getDashboardStats,
  getUsersOverview,
  getServerHealth,
  getAuditLogs,
  getErrorLogs,
  getActivityOverview,
};
