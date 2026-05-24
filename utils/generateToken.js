const jwt = require("jsonwebtoken");

// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS JWT?
// ─────────────────────────────────────────────────────────────────────────────
// JWT = JSON Web Token
//
// It is a compact, self-contained string used to securely transmit information
// between two parties (client ↔ server).
//
// A JWT has 3 parts separated by dots:
//   HEADER.PAYLOAD.SIGNATURE
//   eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjY2YWJjIn0.xK9mT2...
//
// HEADER   — algorithm used to sign (e.g. HS256)
// PAYLOAD  — the actual data (e.g. { id: "user123", iat: 1716000000 })
// SIGNATURE — HEADER + PAYLOAD signed with your JWT_SECRET
//             This proves the token hasn't been tampered with
//
// HOW THE TOKEN FLOW WORKS:
//   1. User logs in → server creates a JWT with their user ID inside
//   2. Server sends the token back to the client
//   3. Client stores it (localStorage or memory)
//   4. On every protected request, client sends:
//        Authorization: Bearer <token>
//   5. Server verifies the signature — if valid, it trusts the payload
//   6. Server reads the user ID from payload, fetches user from DB
//   7. Request is allowed to proceed
//
// IMPORTANT: JWT is NOT encrypted — the payload is just base64 encoded.
// Anyone can decode it. Never put sensitive data (passwords, card numbers) in it.
// The SIGNATURE is what makes it secure — it can't be faked without the secret.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * generateToken
 * Signs a new JWT containing the user's MongoDB _id
 *
 * @param {string} id - The user's MongoDB _id
 * @returns {string} - A signed JWT string
 */
const generateToken = (id) => {
  return jwt.sign(
    { id },                          // PAYLOAD: what we store inside the token
    process.env.JWT_SECRET,          // SECRET: used to sign (keep this private!)
    {
      expiresIn: process.env.JWT_EXPIRE || "7d",
      // ↑ Token expires after 7 days. After that, the user must log in again.
      // You can use: "1h", "30m", "7d", "30d" etc.
    }
  );
};

module.exports = generateToken;
