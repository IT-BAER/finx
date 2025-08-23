module.exports = function isAdmin(req, res, next) {
  try {
    // auth middleware should have set req.user (full DB row)
    if (!req.user) {
      if (process.env.NODE_ENV === "development") {
        // Log to help debug missing auth in dev
        console.warn(
          "[isAdmin] Missing req.user; ensure auth middleware runs before isAdmin",
        );
      }
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Detailed logging (dev-only) to inspect the attached user
    if (process.env.NODE_ENV === "development") {
      // Only log non-sensitive fields
    }

    if (!req.user.is_admin) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[isAdmin] Access denied for user:", {
          id: req.user.id,
          email: req.user.email,
          is_admin: req.user.is_admin,
        });
      }
      return res.status(403).json({ message: "Admin access required" });
    }

    next();
  } catch (e) {
    console.error("[isAdmin] Middleware error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};
