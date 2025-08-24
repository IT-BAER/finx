const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Authentication middleware
 * - Expects Authorization: Bearer <token>, verifies JWT and loads the user
 * - No auto-login in development; use normal login with your dev admin credentials from environment
 */
const auth = async (req, res, next) => {
  try {
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
