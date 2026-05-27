const rateLimit = require("express-rate-limit");

const keyByUser = (req) =>
  req.user && req.user.id != null ? `u:${req.user.id}` : `ip:${req.ip}`;

const perUserHourly = (opts = {}) =>
  rateLimit({
    windowMs: opts.windowMs ?? 60 * 60 * 1000,
    limit: opts.limit ?? 60,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: keyByUser,
    message: {
      error: "AI parse hourly limit reached. Try again later.",
      code: "AI_RATE_LIMIT_HOURLY",
    },
  });

const perUserDaily = (opts = {}) =>
  rateLimit({
    windowMs: opts.windowMs ?? 24 * 60 * 60 * 1000,
    limit: opts.limit ?? 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: keyByUser,
    message: {
      error: "AI parse daily limit reached. Try again tomorrow.",
      code: "AI_RATE_LIMIT_DAILY",
    },
  });

module.exports = { perUserHourly, perUserDaily, keyByUser };
