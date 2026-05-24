const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────────────────────
// TASK MODEL
// ─────────────────────────────────────────────────────────────────────────────
// A Task is the core unit of work in the app.
// Every task MUST belong to a Project.
// A task can optionally be assigned to one User.
//
// Relationships:
//   Task >── Project    (each task belongs to one project)
//   Task >── User       (assignedTo — optional, one user)
//   Task >── User       (createdBy — required, who created it)
//
// Status flow:
//   todo → in-progress → review → done
//
// Priority levels:
//   low → medium → high
// ─────────────────────────────────────────────────────────────────────────────

const taskSchema = new mongoose.Schema(
  {
    // ── Core Fields ────────────────────────────────────────────────────────

    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
      minlength: [3, "Title must be at least 3 characters"],
      maxlength: [150, "Title cannot exceed 150 characters"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
      default: "",
    },

    // ── Project Reference ──────────────────────────────────────────────────
    // Every task MUST belong to a project
    // ref: "Project" enables .populate("project") to get full project details

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Task must belong to a project"],
    },

    // ── User References ────────────────────────────────────────────────────

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Task must have a creator"],
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      // null means unassigned — task is in the backlog
    },

    // ── Status ─────────────────────────────────────────────────────────────
    // Tracks where the task is in the workflow
    // enum with custom message gives a clear error if wrong value is sent

    status: {
      type: String,
      enum: {
        values: ["todo", "in-progress", "review", "done"],
        message: "Status must be: todo, in-progress, review, or done",
      },
      default: "todo",
    },

    // ── Priority ───────────────────────────────────────────────────────────
    // Helps team members know what to work on first

    priority: {
      type: String,
      enum: {
        values: ["low", "medium", "high"],
        message: "Priority must be: low, medium, or high",
      },
      default: "medium",
    },

    // ── Due Date ───────────────────────────────────────────────────────────
    // Named "dueDate" to match the requirement (was "deadline" before)
    // Stored as a JS Date object in MongoDB

    dueDate: {
      type: Date,
      default: null,
    },

    // ── Tags ───────────────────────────────────────────────────────────────
    // Optional array of strings for categorizing tasks
    // e.g. ["frontend", "bug", "urgent"]

    tags: [
      {
        type: String,
        trim: true,
        maxlength: [30, "Each tag cannot exceed 30 characters"],
      },
    ],
  },
  {
    timestamps: true,
    // Adds: createdAt (when created) and updatedAt (when last modified)
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────────
// Indexes make MongoDB queries faster by creating a lookup structure.
// Without indexes, MongoDB does a full collection scan (slow for large data).
//
// Compound index on project + status:
//   Speeds up: "get all tasks for project X with status Y"
//   This is the most common query in the app
//
// Single index on assignedTo:
//   Speeds up: "get all tasks assigned to user X"
//
// Text index on title + description:
//   Enables full-text search: Task.find({ $text: { $search: "login bug" } })
//   MongoDB searches both fields and ranks by relevance
// ─────────────────────────────────────────────────────────────────────────────

taskSchema.index({ project: 1, status: 1 });       // compound index
taskSchema.index({ assignedTo: 1 });               // single field index
taskSchema.index({ project: 1, priority: 1 });     // for priority filter per project
taskSchema.index({ title: "text", description: "text" }); // full-text search

module.exports = mongoose.model("Task", taskSchema);
// Creates a "tasks" collection in MongoDB
