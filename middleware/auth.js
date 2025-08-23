const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Authentication middleware
 * - Normal flow: expects Authorization: Bearer <token>, verifies JWT and loads user
 * - DEV_MODE flow: when process.env.DEV_MODE === 'true', bypasses token checks and
 *   automatically logs in as the admin user specified by DEV_MODE_ADMIN_EMAIL (defaults to admin@finx.local).
 *   If that user does not exist, attempts to create one using DEV_MODE_ADMIN_PASSWORD (fallback 'devpassword').
 *
 * Note: DEV_MODE must be explicitly enabled in your backend .env (DEV_MODE=true) to activate this behavior.
 */
const auth = async (req, res, next) => {
  try {
    // DEV_MODE bypass (safe default: disabled)
    if (process.env.DEV_MODE === "true") {
      try {
        const devEmail = process.env.DEV_MODE_ADMIN_EMAIL || "admin@finx.local";
        let user = await User.findByEmail(devEmail);
        if (!user) {
          // Create a development admin user if it does not exist.
          // Use a configurable password but default to 'devpassword' if not provided.
          const devPass = process.env.DEV_MODE_ADMIN_PASSWORD || "devpassword";
          console.warn(
            `[DEV_MODE] Admin user ${devEmail} not found. Creating a development admin account.`,
          );
          user = await User.create(devEmail, devPass, "Dev", "Admin", true);
        } else {
          // Optionally, you could update last_login or other fields here if desired.
        }

        // Attach the user to the request and continue
        req.user = user;
        return next();
      } catch (devErr) {
        console.error("DEV_MODE authentication error:", devErr);
        // Fall through to normal authentication if DEV_MODE path fails for any reason
      }
    }

    // Normal authentication flow
    // Get token from header
    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "No token, authorization denied" });
    }

    // Extract token
    const token = authHeader.replace("Bearer ", "");

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ message: "Token is not valid" });
    }

    // Get user from database
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "Token is not valid" });
    }

    // Add user to request object
    req.user = user;

    next();
  } catch (err) {
    console.error("Authentication error:", err);
    res.status(401).json({ message: "Token is not valid" });
  }
};

module.exports = auth;
