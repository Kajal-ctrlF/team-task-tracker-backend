const Project = require("../models/Project");
const Task = require("../models/Task");

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────
// Each function here handles one API endpoint.
// All functions use async/await with try/catch for proper error handling.
//
// req.user is available in every function because the protect middleware
// runs before these controllers and attaches the logged-in user to req.
//
// Error response format:
//   { success: false, message: "..." }
//
// Success response format:
//   { success: true, message: "...", data: {...} }
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Create a new project
// @route   POST /api/projects
// @access  Private (requires JWT token)
// ─────────────────────────────────────────────────────────────────────────────
// How it works:
//   1. Extract fields from req.body
//   2. Set createdBy to the logged-in user's ID (from req.user)
//   3. Save to MongoDB
//   4. Return the created project with 201 Created status
// ─────────────────────────────────────────────────────────────────────────────

const createProject = async (req, res) => {
  try {
    const { title, description, members, status, deadline } = req.body;

    // Create the project document in MongoDB
    // createdBy is set from req.user._id — the logged-in user
    // This is why the route is protected: we need to know WHO is creating it
    const project = await Project.create({
      title,
      description,
      status,
      deadline,
      createdBy: req.user._id,   // automatically set — user cannot fake this
      members: members || [],    // optional — defaults to empty array
    });

    // Populate createdBy so the response includes name & email, not just an ID
    // Without populate: createdBy: "64abc123..."
    // With populate:    createdBy: { _id: "64abc123", name: "Mayank", email: "..." }
    await project.populate("createdBy", "name email");

    res.status(201).json({
      // 201 Created — used when a new resource is successfully created
      success: true,
      message: "Project created successfully",
      data: project,
    });
  } catch (error) {
    // Mongoose validation errors (e.g. title too short) are caught here
    // and forwarded to the global error handler in errorMiddleware.js
    res.status(500).json({
      success: false,
      message: error.message || "Server error while creating project",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all projects for the logged-in user
// @route   GET /api/projects
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
// How it works:
//   1. Build a filter: show projects where user is owner OR a member
//   2. Apply optional query filters: ?status=active, ?search=website
//   3. Populate owner and member details
//   4. Return sorted list (newest first)
//
// Query params supported:
//   ?status=active|completed|archived
//   ?search=keyword  (searches in title)
// ─────────────────────────────────────────────────────────────────────────────

const getProjects = async (req, res) => {
  try {
    const { status, search } = req.query;

    // $or operator: match documents where AT LEAST ONE condition is true
    // This means: "give me projects I created OR projects I'm a member of"
    const filter = {
      $or: [
        { createdBy: req.user._id },
        { members: req.user._id },
      ],
    };

    // Conditionally add more filters based on query params
    if (status) {
      filter.status = status; // exact match: status === "active"
    }

    if (search) {
      // $regex: search for a pattern inside a string
      // $options: "i" makes it case-insensitive
      // e.g. search="web" matches "Website Redesign", "web app", "WEB project"
      filter.title = { $regex: search, $options: "i" };
    }

    const projects = await Project.find(filter)
      .populate("createdBy", "name email")   // replace ID with user details
      .populate("members", "name email")     // replace each member ID with details
      .sort({ createdAt: -1 });              // -1 = descending = newest first

    res.status(200).json({
      success: true,
      count: projects.length,   // useful for the frontend to know total count
      data: projects,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error while fetching projects",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get a single project by its ID
// @route   GET /api/projects/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
// How it works:
//   1. Find project by :id from the URL
//   2. If not found → 404
//   3. Check if logged-in user is the owner OR a member
//   4. If neither → 403 Forbidden
//   5. Return the project
// ─────────────────────────────────────────────────────────────────────────────

const getProjectById = async (req, res) => {
  try {
    // req.params.id comes from the URL: GET /api/projects/64abc123
    const project = await Project.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("members", "name email");

    // If no project found with this ID
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Authorization check: only owner or members can view this project
    // We compare IDs as strings because MongoDB ObjectIds are objects, not strings
    const isOwner =
      project.createdBy._id.toString() === req.user._id.toString();

    const isMember = project.members.some(
      (member) => member._id.toString() === req.user._id.toString()
    );

    if (!isOwner && !isMember) {
      return res.status(403).json({
        // 403 Forbidden — you're logged in but not allowed to see this
        success: false,
        message: "Access denied. You are not part of this project.",
      });
    }

    res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    // CastError happens when :id is not a valid MongoDB ObjectId format
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Server error while fetching project",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update a project
// @route   PUT /api/projects/:id
// @access  Private (owner only)
// ─────────────────────────────────────────────────────────────────────────────
// How it works:
//   1. Find the project by ID
//   2. If not found → 404
//   3. Check if logged-in user is the owner (only owner can update)
//   4. Update only the fields that were sent in req.body
//   5. Save and return updated project
//
// Why we use project.save() instead of findByIdAndUpdate():
//   .save() triggers Mongoose validators and pre-save hooks
//   findByIdAndUpdate() skips them by default
// ─────────────────────────────────────────────────────────────────────────────

const updateProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Only the project creator can update it
    // toString() is needed because ObjectId !== string comparison
    if (project.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only the project owner can update it.",
      });
    }

    const { title, description, members, status, deadline } = req.body;

    // Only update fields that were actually sent
    // Using ?? (nullish coalescing) for description/deadline:
    //   - || would skip empty string "" (wrong — user might want to clear it)
    //   - ?? only skips null and undefined (correct behavior)
    if (title !== undefined)       project.title = title;
    if (description !== undefined) project.description = description;
    if (members !== undefined)     project.members = members;
    if (status !== undefined)      project.status = status;
    if (deadline !== undefined)    project.deadline = deadline;

    // .save() runs validators and the updatedAt timestamp is auto-updated
    const updatedProject = await project.save();

    // Populate after save so response has full user details
    await updatedProject.populate([
      { path: "createdBy", select: "name email" },
      { path: "members", select: "name email" },
    ]);

    res.status(200).json({
      success: true,
      message: "Project updated successfully",
      data: updatedProject,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Server error while updating project",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete a project (and all its tasks)
// @route   DELETE /api/projects/:id
// @access  Private (owner only)
// ─────────────────────────────────────────────────────────────────────────────
// How it works:
//   1. Find the project by ID
//   2. If not found → 404
//   3. Check if logged-in user is the owner
//   4. Delete all tasks that belong to this project (cascade delete)
//   5. Delete the project itself
//   6. Return success message
//
// Why cascade delete tasks?
//   If we only delete the project, all its tasks become "orphaned" —
//   they still exist in the DB but their project no longer exists.
//   This wastes storage and causes bugs. So we clean them up too.
// ─────────────────────────────────────────────────────────────────────────────

const deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Only the owner can delete the project
    if (project.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only the project owner can delete it.",
      });
    }

    // Step 1: Delete all tasks that belong to this project
    // deleteMany() removes ALL documents matching the filter
    const deletedTasks = await Task.deleteMany({ project: project._id });

    // Step 2: Delete the project itself
    await project.deleteOne();

    res.status(200).json({
      success: true,
      message: "Project deleted successfully",
      deletedTasksCount: deletedTasks.deletedCount,
      // Useful info: tells the client how many tasks were also removed
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Server error while deleting project",
    });
  }
};

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
};
