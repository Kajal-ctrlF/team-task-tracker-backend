const express = require("express");
const router = express.Router();

// Controllers — the actual logic
const {
  registerUser,
  loginUser,
  getMe,
  updateProfile,
} = require("../controllers/authController");

// Middleware — guards and validators
const { protect } = require("../middleware/authMiddleware");
const {
  registerRules,
  loginRules,
  handleValidation,
} = require("../middleware/validate");

// ─────────────────────────────────────────────────────────────────────────────
// HOW ROUTE MIDDLEWARE CHAINS WORK
// ─────────────────────────────────────────────────────────────────────────────
// Express processes middleware left to right.
// Each function must either call next() or send a response.
//
// router.post("/register", registerRules, handleValidation, registerUser)
//
//   Step 1: registerRules   — runs validation checks, attaches results to req
//   Step 2: handleValidation — reads results; if errors → sends 422, stops here
//   Step 3: registerUser    — only runs if validation passed
// ─────────────────────────────────────────────────────────────────────────────

// ── PUBLIC ROUTES (no token required) ────────────────────────────────────────

// POST /api/auth/register
router.post("/register", registerRules, handleValidation, registerUser);

// POST /api/auth/login
router.post("/login", loginRules, handleValidation, loginUser);

// ── PRIVATE ROUTES (valid JWT required) ──────────────────────────────────────

// GET /api/auth/me
router.get("/me", protect, getMe);

// PUT /api/auth/me
router.put("/me", protect, updateProfile);

module.exports = router;
