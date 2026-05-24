const express = require("express");
const router = express.Router();

// Controller functions — the actual logic for each endpoint
const {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
} = require("../controllers/projectController");

// Middleware
const { protect } = require("../middleware/authMiddleware");
const {
  createProjectRules,
  updateProjectRules,
  handleValidation,
} = require("../middleware/validate");

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT ROUTES
// ─────────────────────────────────────────────────────────────────────────────
// router.use(protect) applies the JWT check to ALL routes in this file.
// Every request to /api/projects/* must include a valid Bearer token.
//
// Route chain explanation:
//   protect         → checks JWT, attaches req.user
//   createProjectRules → runs validation rules on req.body
//   handleValidation   → if validation fails, sends 422 and stops
//   createProject      → runs only if all above passed
// ─────────────────────────────────────────────────────────────────────────────

// Apply protect middleware to ALL routes below this line
router.use(protect);

// ── /api/projects ─────────────────────────────────────────────────────────────

router
  .route("/")
  .get(getProjects)                                          // GET  /api/projects
  .post(createProjectRules, handleValidation, createProject); // POST /api/projects

// ── /api/projects/:id ─────────────────────────────────────────────────────────

router
  .route("/:id")
  .get(getProjectById)                                              // GET    /api/projects/:id
  .put(updateProjectRules, handleValidation, updateProject)         // PUT    /api/projects/:id
  .delete(deleteProject);                                           // DELETE /api/projects/:id

module.exports = router;
