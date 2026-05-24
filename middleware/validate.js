const { body, validationResult } = require("express-validator");

// ─────────────────────────────────────────────────────────────────────────────
// CENTRALIZED VALIDATION MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────
// All validation rules for every feature live in this one file.
//
// How it works:
//   1. Define a rules array for each operation (e.g. createTaskRules)
//   2. Add the rules array + handleValidation to the route BEFORE the controller
//   3. handleValidation reads the results — if any rule failed, it sends 422
//   4. Controller only runs if ALL rules passed
//
// Route example:
//   router.post("/", createTaskRules, handleValidation, createTask)
//   Request → createTaskRules → handleValidation → createTask (if valid)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * handleValidation
 * Must be placed AFTER the rules array in the route.
 * Collects all validation errors and returns them in one response.
 * If no errors, calls next() to proceed to the controller.
 */
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Map errors to just the message strings for a clean response
    const messages = errors.array().map((err) => err.msg);

    return res.status(422).json({
      // 422 Unprocessable Entity — request was understood but data is invalid
      success: false,
      message: "Validation failed",
      errors: messages,
    });
  }

  next(); // all rules passed — proceed to controller
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTH VALIDATION RULES
// ─────────────────────────────────────────────────────────────────────────────

const registerRules = [
  body("name")
    .trim()
    .notEmpty().withMessage("Name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),

  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Please enter a valid email address")
    .normalizeEmail(),

  body("password")
    .notEmpty().withMessage("Password is required")
    .isLength({ min: 6 }).withMessage("Password must be at least 6 characters")
    .matches(/\d/).withMessage("Password must contain at least one number"),
];

const loginRules = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Please enter a valid email address")
    .normalizeEmail(),

  body("password")
    .notEmpty().withMessage("Password is required"),
];

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT VALIDATION RULES
// ─────────────────────────────────────────────────────────────────────────────

const createProjectRules = [
  body("title")
    .trim()
    .notEmpty().withMessage("Project title is required")
    .isLength({ min: 3, max: 100 })
    .withMessage("Title must be between 3 and 100 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("status")
    .optional()
    .isIn(["active", "completed", "archived"])
    .withMessage("Status must be: active, completed, or archived"),

  body("deadline")
    .optional()
    .isISO8601().withMessage("Deadline must be a valid date (YYYY-MM-DD)")
    .toDate(),
];

const updateProjectRules = [
  body("title")
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage("Title must be between 3 and 100 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("status")
    .optional()
    .isIn(["active", "completed", "archived"])
    .withMessage("Status must be: active, completed, or archived"),

  body("deadline")
    .optional()
    .isISO8601().withMessage("Deadline must be a valid date (YYYY-MM-DD)")
    .toDate(),
];

// ─────────────────────────────────────────────────────────────────────────────
// TASK VALIDATION RULES
// ─────────────────────────────────────────────────────────────────────────────

const createTaskRules = [
  body("title")
    .trim()
    .notEmpty().withMessage("Task title is required")
    .isLength({ min: 3, max: 150 })
    .withMessage("Title must be between 3 and 150 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),

  body("project")
    .notEmpty().withMessage("Project ID is required")
    .isMongoId().withMessage("Project ID must be a valid MongoDB ID"),
    // isMongoId() checks that the value is a valid 24-character hex string
    // This prevents CastError crashes from invalid ID formats

  body("assignedTo")
    .optional()
    .isMongoId().withMessage("Assigned user ID must be a valid MongoDB ID"),

  body("status")
    .optional()
    .isIn(["todo", "in-progress", "review", "done"])
    .withMessage("Status must be: todo, in-progress, review, or done"),

  body("priority")
    .optional()
    .isIn(["low", "medium", "high"])
    .withMessage("Priority must be: low, medium, or high"),

  body("dueDate")
    .optional()
    .isISO8601().withMessage("Due date must be a valid date (YYYY-MM-DD)")
    .toDate(),

  body("tags")
    .optional()
    .isArray().withMessage("Tags must be an array")
    .custom((tags) => {
      // Validate each tag in the array
      if (tags.some((tag) => typeof tag !== "string" || tag.length > 30)) {
        throw new Error("Each tag must be a string under 30 characters");
      }
      return true;
    }),
];

const updateTaskRules = [
  body("title")
    .optional()
    .trim()
    .isLength({ min: 3, max: 150 })
    .withMessage("Title must be between 3 and 150 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),

  body("assignedTo")
    .optional({ nullable: true })
    // nullable: true allows null to be passed (to unassign a task)
    .custom((value) => {
      if (value === null) return true; // allow null to unassign
      if (!value.match(/^[0-9a-fA-F]{24}$/)) {
        throw new Error("Assigned user ID must be a valid MongoDB ID");
      }
      return true;
    }),

  body("status")
    .optional()
    .isIn(["todo", "in-progress", "review", "done"])
    .withMessage("Status must be: todo, in-progress, review, or done"),

  body("priority")
    .optional()
    .isIn(["low", "medium", "high"])
    .withMessage("Priority must be: low, medium, or high"),

  body("dueDate")
    .optional()
    .isISO8601().withMessage("Due date must be a valid date (YYYY-MM-DD)")
    .toDate(),
];

// Dedicated rule for PATCH /api/tasks/:id/status
const updateTaskStatusRules = [
  body("status")
    .notEmpty().withMessage("Status is required")
    .isIn(["todo", "in-progress", "review", "done"])
    .withMessage("Status must be: todo, in-progress, review, or done"),
];

module.exports = {
  handleValidation,
  // auth
  registerRules,
  loginRules,
  // projects
  createProjectRules,
  updateProjectRules,
  // tasks
  createTaskRules,
  updateTaskRules,
  updateTaskStatusRules,
};
