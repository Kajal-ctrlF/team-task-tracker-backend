const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ─────────────────────────────────────────────────────────────────────────────
// HOW MIDDLEWARE PROTECTS ROUTES
// ─────────────────────────────────────────────────────────────────────────────
// Middleware is a function that runs BETWEEN the request arriving and the
// controller handling it. Think of it as a security checkpoint.
//
// Without protect middleware:
//   Request → Controller (anyone can access)
//
// With protect middleware:
//   Request → protect() → Controller (only valid token holders get through)
//
// The protect function:
//   1. Reads the Authorization header: "Bearer eyJhbGci..."
//   2. Extracts the token part after "Bearer "
//   3. Verifies the token using JWT_SECRET
//      - If tampered with → verification fails → 401
//      - If expired → verification fails → 401
//      - If valid → decode the payload to get the user ID
//   4. Fetches the user from DB using that ID
//   5. Attaches the user to req.user
//   6. Calls next() — the request continues to the controller
//
// Usage in routes:
//   router.get("/me", protect, getMe)
//   The protect function runs first. If it calls next(), getMe runs.
//   If it sends a response (401), getMe never runs.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * protect
 * Guards private routes — only authenticated users can pass
 */
const protect = async (req, res, next) => {
  let token;

  // Check the Authorization header
  // Expected format: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJpZCI6..."
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    // Split "Bearer <token>" and take the second part
    token = req.headers.authorization.split(" ")[1];
  }

  // No token found — reject immediately
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. Please log in to continue.",
    });
  }

  try {
    // jwt.verify() does two things:
    //   1. Checks the signature (was this token signed with our secret?)
    //   2. Checks expiry (has the token expired?)
    // If either check fails, it throws an error caught below.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // decoded = { id: "64abc123...", iat: 1716000000, exp: 1716604800 }
    //   iat = issued at (Unix timestamp)
    //   exp = expiry (Unix timestamp)

    // Fetch the user from DB using the ID stored in the token
    // We exclude the password field since we don't need it here
    req.user = await User.findById(decoded.id).select("-password");

    // Edge case: user was deleted after the token was issued
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "The user belonging to this token no longer exists.",
      });
    }

    // Everything checks out — pass control to the next handler
    next();
  } catch (error) {
    // jwt.verify() threw — token is invalid or expired
    let message = "Not authorized. Invalid token.";

    if (error.name === "TokenExpiredError") {
      message = "Your session has expired. Please log in again.";
    } else if (error.name === "JsonWebTokenError") {
      message = "Invalid token. Please log in again.";
    }

    return res.status(401).json({
      success: false,
      message,
    });
  }
};

/**
 * adminOnly
 * Restricts a route to admin users only.
 * MUST be used AFTER protect — it relies on req.user being set.
 *
 * Usage: router.delete("/users/:id", protect, adminOnly, deleteUser)
 */
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next(); // user is admin — allow through
  } else {
    res.status(403).json({
      // 403 Forbidden (different from 401 Unauthorized)
      // 401 = not authenticated (no/bad token)
      // 403 = authenticated but not allowed (wrong role)
      success: false,
      message: "Access denied. Admin privileges required.",
    });
  }
};

module.exports = { protect, adminOnly };
