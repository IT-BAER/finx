const express = require("express");
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

const router = express.Router();

// Register route - only enable if DISABLE_REGISTRATION is not set to true
if (process.env.DISABLE_REGISTRATION !== "true") {
  router.post("/register", register);
} else {
  router.post("/register", (req, res) => {
    res.status(403).json({ message: "Registration is disabled" });
  });
}

// Login route
router.post("/login", login);

// Refresh token route (no auth middleware - uses refresh token for authentication)
router.post("/refresh", refreshToken);

// Logout route (protected - needs valid access token or refresh token)
router.post("/logout", auth, logout);

// Get current user (protected route)
router.get("/me", auth, getCurrentUser);

// Update user (protected route)
router.put("/me", auth, updateUser);

// Change password (protected route)
router.post("/change-password", auth, changePassword);

// Delete account (protected route)
router.delete("/me", auth, deleteAccount);

module.exports = router;

