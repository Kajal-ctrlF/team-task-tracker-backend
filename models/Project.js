const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT MODEL
// ─────────────────────────────────────────────────────────────────────────────
// A Project is the top-level container in our app.
// Every Task belongs to a Project.
// The user who creates a project becomes its "createdBy" (owner).
//
// Relationships:
//   Project ──< Tasks       (one project has many tasks)
//   Project >── User        (createdBy references one user)
//   Project >──< Users      (members array references many users)
// ─────────────────────────────────────────────────────────────────────────────

const projectSchema = new mongoose.Schema(
  {
    // ── Core Fields ────────────────────────────────────────────────────────

    title: {
      type: String,
      required: [true, "Project title is required"],
      trim: true,                   // removes extra spaces from both ends
      minlength: [3, "Title must be at least 3 characters"],
      maxlength: [100, "Title cannot exceed 100 characters"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",                  // optional field — defaults to empty string
    },

    // ── Ownership ──────────────────────────────────────────────────────────
    // mongoose.Schema.Types.ObjectId means this field stores a MongoDB ID
    // ref: "User" tells Mongoose which model to use when we call .populate()
    // populate() replaces the raw ID with the actual user document

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Project must have an owner"],
    },

    // ── Team Members ───────────────────────────────────────────────────────
    // An array of User IDs — people who are part of this project
    // The owner (createdBy) is separate from members

    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // ── Status ─────────────────────────────────────────────────────────────
    // enum restricts the value to only these three options
    // If you try to save "pending" it will throw a validation error

    status: {
      type: String,
      enum: {
        values: ["active", "completed", "archived"],
        message: "Status must be active, completed, or archived",
      },
      default: "active",
    },

    // ── Optional Deadline ──────────────────────────────────────────────────

    deadline: {
      type: Date,
      default: null,
    },
  },
  {
    // timestamps: true automatically adds:
    //   createdAt — set once when document is first created
    //   updatedAt — updated every time the document is saved
    timestamps: true,

    // toJSON: { virtuals: true } — include virtual fields when converting to JSON
    // We'll use this for the taskCount virtual below
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// VIRTUAL FIELD — taskCount
// ─────────────────────────────────────────────────────────────────────────────
// A virtual is a field that is NOT stored in MongoDB.
// It is computed on the fly when you query the document.
// This virtual creates a reverse relationship: "give me all tasks for this project"
// Used with .populate("tasks") to get task count without storing it.
// ─────────────────────────────────────────────────────────────────────────────

projectSchema.virtual("tasks", {
  ref: "Task",           // the model to use
  localField: "_id",     // field in THIS model (Project._id)
  foreignField: "project", // field in Task model that references Project
});

// ─────────────────────────────────────────────────────────────────────────────
// INDEX — speeds up queries that filter by createdBy
// Without an index, MongoDB scans every document to find matches.
// With an index, it jumps directly to the matching documents.
// ─────────────────────────────────────────────────────────────────────────────

projectSchema.index({ createdBy: 1 });
projectSchema.index({ title: "text", description: "text" }); // enables text search

module.exports = mongoose.model("Project", projectSchema);
// Mongoose creates a "projects" collection in MongoDB (auto-pluralized)
