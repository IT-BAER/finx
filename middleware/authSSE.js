const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Authentication middleware for Server-Sent Events (SSE).
 * Accepts JWT via standard Authorization: Bearer <token> header or a `token` query string parameter
 * because EventSource cannot set custom headers.
 */
module.exports = async function authSSE(req, res, next) {
  try {
    let token = null;

    const authHeader = req.header("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "");
    }
    if (!token && req.query && req.query.token) {
      token = String(req.query.token);
    }

    if (!token) {
      return res.status(401).json({ message: "No token, authorization denied" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ message: "Token is not valid" });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "Token is not valid" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("SSE auth error:", err);
    res.status(401).json({ message: "Token is not valid" });
  }
};
