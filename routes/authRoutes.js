const express = require("express");
const router  = express.Router();

const {
  registerUser,
  loginUser,
  getMe,
  updateProfile,
  forgotPassword,
  verifyOtp,
  resetPassword,
} = require("../controllers/authController");

const { protect }                    = require("../middleware/authMiddleware");
const { registerRules, loginRules, handleValidation } = require("../middleware/validate");

// ── Public routes ─────────────────────────────────────────────────────────────
router.post("/register",       registerRules, handleValidation, registerUser);
router.post("/login",          loginRules,    handleValidation, loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp",      verifyOtp);
router.post("/reset-password",  resetPassword);

// ── Private routes ────────────────────────────────────────────────────────────
router.get("/me",  protect, getMe);
router.put("/me",  protect, updateProfile);

module.exports = router;
