const express = require("express");
const router = express.Router();

// Controller functions
const {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
  deleteTask,
} = require("../controllers/taskController");

// Middleware
const { protect } = require("../middleware/authMiddleware");
const {
  createTaskRules,
  updateTaskRules,
  updateTaskStatusRules,
  handleValidation,
} = require("../middleware/validate");

// ─────────────────────────────────────────────────────────────────────────────
// TASK ROUTES
// ─────────────────────────────────────────────────────────────────────────────
// All routes are protected — every request must include a valid JWT token.
// router.use(protect) applies the JWT check to every route in this file.
//
// Route middleware chain (left to right):
//   protect → validation rules → handleValidation → controller
//
// The controller only runs if:
//   ✓ Token is valid (protect passed)
//   ✓ All validation rules passed (handleValidation passed)
// ─────────────────────────────────────────────────────────────────────────────

// Apply JWT protection to ALL routes below
router.use(protect);

// ── /api/tasks ────────────────────────────────────────────────────────────────

router
  .route("/")
  .get(getTasks)                                        // GET  /api/tasks
  .post(createTaskRules, handleValidation, createTask); // POST /api/tasks

// ── /api/tasks/:id ────────────────────────────────────────────────────────────

router
  .route("/:id")
  .get(getTaskById)                                              // GET    /api/tasks/:id
  .put(updateTaskRules, handleValidation, updateTask)            // PUT    /api/tasks/:id
  .delete(deleteTask);                                           // DELETE /api/tasks/:id

// ── /api/tasks/:id/status ─────────────────────────────────────────────────────
// Dedicated PATCH endpoint for status-only updates (e.g. Kanban drag-and-drop)
// PATCH = partial update (only one field), vs PUT = full update

router.patch(
  "/:id/status",
  updateTaskStatusRules,
  handleValidation,
  updateTaskStatus
); // PATCH /api/tasks/:id/status

module.exports = router;
