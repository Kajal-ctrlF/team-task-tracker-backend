const express = require("express");
const router = express.Router();

const {
  getDashboardStats,
  getActivityStats,
  getOverdueTasks,
} = require("../controllers/dashboardController");

const { protect } = require("../middleware/authMiddleware");

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD ROUTES
// ─────────────────────────────────────────────────────────────────────────────
// All dashboard routes are private — require a valid JWT token.
// router.use(protect) applies the JWT check to every route in this file.
//
// Routes:
//   GET /api/dashboard           → main stats (summary, breakdowns, recent items)
//   GET /api/dashboard/activity  → 7-day task creation/completion chart data
//   GET /api/dashboard/overdue   → list of overdue tasks with days overdue
// ─────────────────────────────────────────────────────────────────────────────

// Apply JWT protection to ALL routes in this file
router.use(protect);

// Main dashboard — all stats in one call
router.get("/", getDashboardStats);

// 7-day activity data for charts
router.get("/activity", getActivityStats);

// Overdue tasks list
router.get("/overdue", getOverdueTasks);

module.exports = router;
