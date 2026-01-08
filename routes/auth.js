const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  register,
  login,
  getCurrentUser,
  updateUser,
  changePassword,
  deleteAccount,
  refreshToken,
  logout,
} = require("../controllers/authController");
const auth = require("../middleware/auth");
const { validateBody } = require("../middleware/validation");
const {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
} = require("../middleware/validation/schemas");

const router = express.Router();

// ============================================================================
// Auth-specific rate limiters
// ============================================================================

// Login/Register limiter - bruteforce protection
// Only counts failed requests to prevent lockout of legitimate users
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 15, // 15 failed attempts per 15 min (1 per minute average)
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Too many authentication attempts. Please try again in 15 minutes." },
});

// Token refresh limiter - more generous for mobile app background sync
// Token refresh is automatic and essential for app functionality
const refreshLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: 20, // 20 refreshes per minute (handles multiple devices, retries, background sync)
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many token refresh requests. Please wait before retrying." },
});

// Password change limiter - strict to prevent abuse
const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5, // 5 attempts per hour
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Too many password change attempts. Please try again in an hour." },
});

// Account deletion limiter - very strict
const deletionLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  limit: 3, // 3 attempts per day
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many account deletion attempts. Please try again tomorrow." },
});

// ============================================================================
// Routes
// ============================================================================

// Register route - only enable if DISABLE_REGISTRATION is not set to true
if (process.env.DISABLE_REGISTRATION !== "true") {
  router.post("/register", loginLimiter, validateBody(registerSchema), register);
} else {
  router.post("/register", (req, res) => {
    res.status(403).json({ message: "Registration is disabled" });
  });
}

// Login route
router.post("/login", loginLimiter, validateBody(loginSchema), login);

// Refresh token route (no auth middleware - uses refresh token for authentication)
router.post("/refresh", refreshLimiter, refreshToken);

// Logout route (protected - needs valid access token or refresh token)
router.post("/logout", auth, logout);

// Get current user (protected route)
router.get("/me", auth, getCurrentUser);

// Update user (protected route)
router.put("/me", auth, validateBody(updateProfileSchema), updateUser);

// Change password (protected route)
router.post("/change-password", auth, passwordChangeLimiter, validateBody(changePasswordSchema), changePassword);

// Delete account (protected route)
router.delete("/me", auth, deletionLimiter, deleteAccount);

module.exports = router;

