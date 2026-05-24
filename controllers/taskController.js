const Task = require("../models/Task");
const Project = require("../models/Project");

// ─────────────────────────────────────────────────────────────────────────────
// TASK CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────
// Handles all task-related API operations.
// Every function uses async/await with try/catch for safe error handling.
//
// Key concepts used throughout:
//   req.user     — the logged-in user (set by protect middleware)
//   req.params   — URL parameters like :id
//   req.body     — data sent in the request body (JSON)
//   req.query    — URL query params like ?status=todo&page=2
//   populate()   — replaces a MongoDB ObjectId with the actual document
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTION — checkProjectAccess
// ─────────────────────────────────────────────────────────────────────────────
// Reusable function to verify if a user can access a project.
// A user has access if they are the project creator OR a member.
//
// Why we need this:
//   Tasks are scoped to projects. Before any task operation, we must confirm
//   the logged-in user actually belongs to that project.
//   Without this check, any logged-in user could read/modify anyone's tasks.
//
// @param {Object} project  - The full project document from MongoDB
// @param {string} userId   - The logged-in user's _id (from req.user._id)
// @returns {boolean}       - true if user has access, false otherwise
// ─────────────────────────────────────────────────────────────────────────────

const checkProjectAccess = (project, userId) => {
  // Compare as strings — MongoDB ObjectIds are objects, not primitives
  const isOwner = project.createdBy.toString() === userId.toString();

  // .some() returns true if at least one member matches
  const isMember = project.members.some(
    (memberId) => memberId.toString() === userId.toString()
  );

  return isOwner || isMember;
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — populateTask
// ─────────────────────────────────────────────────────────────────────────────
// Reusable populate config so we don't repeat it in every controller.
// populate() replaces ObjectId references with actual document data.
//
// Without populate:
//   { assignedTo: "64abc123...", project: "64xyz456..." }
//
// With populate:
//   { assignedTo: { _id: "64abc123", name: "Mayank", email: "..." },
//     project:    { _id: "64xyz456", title: "Website Redesign" } }
// ─────────────────────────────────────────────────────────────────────────────

const populateTask = (query) => {
  return query
    .populate("assignedTo", "name email avatar")   // user assigned to task
    .populate("createdBy", "name email")           // user who created task
    .populate("project", "title status");          // project this task belongs to
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Create a new task inside a project
// @route   POST /api/tasks
// @access  Private — only project owner or members can create tasks
// ─────────────────────────────────────────────────────────────────────────────
// Flow:
//   1. Validate input (done by createTaskRules before this runs)
//   2. Find the project — verify it exists
//   3. Check if logged-in user has access to that project
//   4. Create the task with createdBy = logged-in user
//   5. Populate and return the created task
// ─────────────────────────────────────────────────────────────────────────────

const createTask = async (req, res) => {
  try {
    const { title, description, project, assignedTo, status, priority, dueDate, tags } =
      req.body;

    // Step 1: Verify the project exists
    // We need the full project doc to check membership
    const projectDoc = await Project.findById(project);

    if (!projectDoc) {
      return res.status(404).json({
        success: false,
        message: "Project not found. Please provide a valid project ID.",
      });
    }

    // Step 2: Check if the logged-in user belongs to this project
    if (!checkProjectAccess(projectDoc, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You are not a member of this project.",
      });
    }

    // Step 3: If assignedTo is provided, verify that user is a project member
    // You shouldn't be able to assign a task to someone outside the project
    if (assignedTo) {
      const isAssigneeMember =
        projectDoc.createdBy.toString() === assignedTo ||
        projectDoc.members.some((m) => m.toString() === assignedTo);

      if (!isAssigneeMember) {
        return res.status(400).json({
          success: false,
          message: "Assigned user is not a member of this project.",
        });
      }
    }

    // Step 4: Create the task
    const task = await Task.create({
      title,
      description,
      project,
      assignedTo: assignedTo || null,
      createdBy: req.user._id,   // always set from token — cannot be faked
      status: status || "todo",
      priority: priority || "medium",
      dueDate: dueDate || null,
      tags: tags || [],
    });

    // Step 5: Populate references and return
    const populatedTask = await populateTask(Task.findById(task._id));

    res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: populatedTask,
    });
  } catch (error) {
    // Mongoose validation error (e.g. title too short)
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(", ") });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Server error while creating task",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all tasks with search, filter, and pagination
// @route   GET /api/tasks
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
// Supported query parameters:
//   ?projectId=<id>       filter by project
//   ?status=todo          filter by status
//   ?priority=high        filter by priority
//   ?assignedTo=<userId>  filter by assigned user
//   ?search=login bug     full-text search in title + description
//   ?page=1               page number (default: 1)
//   ?limit=10             results per page (default: 10)
//
// Flow:
//   1. Build a dynamic filter object from query params
//   2. Run the query + count in parallel (Promise.all for performance)
//   3. Return paginated results with metadata
// ─────────────────────────────────────────────────────────────────────────────

const getTasks = async (req, res) => {
  try {
    const {
      projectId,
      status,
      priority,
      assignedTo,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    // Build filter dynamically — only add conditions that were provided
    const filter = {};

    if (projectId) filter.project = projectId;
    if (status)    filter.status = status;
    if (priority)  filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;

    // Full-text search using MongoDB's $text operator
    // Requires the text index defined in the Task model
    // Searches across both title and description fields simultaneously
    if (search) {
      filter.$text = { $search: search };
    }

    // Pagination math:
    //   page=1, limit=10 → skip=0  (show items 1-10)
    //   page=2, limit=10 → skip=10 (show items 11-20)
    //   page=3, limit=10 → skip=20 (show items 21-30)
    const pageNum  = Math.max(1, parseInt(page));   // minimum page is 1
    const limitNum = Math.min(50, parseInt(limit));  // maximum 50 per page
    const skip     = (pageNum - 1) * limitNum;

    // Run both queries at the same time using Promise.all
    // This is faster than running them one after the other
    // tasks = the actual results, total = count for pagination math
    const [tasks, total] = await Promise.all([
      populateTask(
        Task.find(filter)
          .sort({ createdAt: -1 }) // newest first
          .skip(skip)
          .limit(limitNum)
      ),
      Task.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      count: tasks.length,          // tasks on THIS page
      total,                        // total matching tasks across ALL pages
      page: pageNum,
      pages: Math.ceil(total / limitNum), // total number of pages
      data: tasks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error while fetching tasks",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get a single task by ID
// @route   GET /api/tasks/:id
// @access  Private — only project members can view
// ─────────────────────────────────────────────────────────────────────────────
// Flow:
//   1. Find task by :id, populate all references
//   2. If not found → 404
//   3. Load the parent project to check membership
//   4. If user is not a project member → 403
//   5. Return the task
// ─────────────────────────────────────────────────────────────────────────────

const getTaskById = async (req, res) => {
  try {
    const task = await populateTask(Task.findById(req.params.id));

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Load the project to check if user has access
    // We need the raw project (not the populated one) for membership check
    const project = await Project.findById(task.project._id);

    if (!project || !checkProjectAccess(project, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You are not a member of this project.",
      });
    }

    res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid task ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Server error while fetching task",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update a task (any field except project and createdBy)
// @route   PUT /api/tasks/:id
// @access  Private — project members can update, only creator can reassign
// ─────────────────────────────────────────────────────────────────────────────
// Flow:
//   1. Find task by ID
//   2. Check project membership
//   3. Update only the fields that were sent (partial update)
//   4. Save and return updated task
//
// Why partial update?
//   If user only sends { status: "done" }, we should NOT clear title/description.
//   We check each field with !== undefined before updating.
// ─────────────────────────────────────────────────────────────────────────────

const updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Check project membership before allowing update
    const project = await Project.findById(task.project);

    if (!project || !checkProjectAccess(project, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You are not a member of this project.",
      });
    }

    const { title, description, status, priority, assignedTo, dueDate, tags } =
      req.body;

    // Partial update — only change fields that were actually sent
    // undefined means "not sent in request" — we skip those
    // null is a valid value (e.g. to unassign a user or clear a date)
    if (title !== undefined)       task.title = title;
    if (description !== undefined) task.description = description;
    if (status !== undefined)      task.status = status;
    if (priority !== undefined)    task.priority = priority;
    if (assignedTo !== undefined)  task.assignedTo = assignedTo; // null = unassign
    if (dueDate !== undefined)     task.dueDate = dueDate;       // null = clear date
    if (tags !== undefined)        task.tags = tags;

    // .save() triggers Mongoose validators and updates the updatedAt timestamp
    const updatedTask = await task.save();

    // Populate after save for the response
    const populatedTask = await populateTask(Task.findById(updatedTask._id));

    res.status(200).json({
      success: true,
      message: "Task updated successfully",
      data: populatedTask,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid task ID format",
      });
    }

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(", ") });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Server error while updating task",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update ONLY the status of a task (dedicated endpoint)
// @route   PATCH /api/tasks/:id/status
// @access  Private — project members can update status
// ─────────────────────────────────────────────────────────────────────────────
// Why a separate endpoint for status?
//   In Kanban-style UIs, dragging a card between columns only changes status.
//   A dedicated PATCH endpoint is cleaner than sending a full PUT request.
//   PATCH = partial update of a resource (vs PUT = full replacement)
// ─────────────────────────────────────────────────────────────────────────────

const updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Check project membership
    const project = await Project.findById(task.project);

    if (!project || !checkProjectAccess(project, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You are not a member of this project.",
      });
    }

    const previousStatus = task.status; // save for response info
    task.status = status;

    await task.save();

    const populatedTask = await populateTask(Task.findById(task._id));

    res.status(200).json({
      success: true,
      message: `Task status updated: ${previousStatus} → ${status}`,
      data: populatedTask,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid task ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Server error while updating task status",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete a task
// @route   DELETE /api/tasks/:id
// @access  Private — only task creator OR project owner can delete
// ─────────────────────────────────────────────────────────────────────────────
// Flow:
//   1. Find task by ID
//   2. Check project membership (must be in the project at minimum)
//   3. Check delete permission (must be task creator OR project owner)
//   4. Delete and return success
//
// Why stricter permission for delete?
//   Any member can view/update tasks, but only the creator or project owner
//   should be able to permanently delete a task.
// ─────────────────────────────────────────────────────────────────────────────

const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Load project for permission checks
    const project = await Project.findById(task.project);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Parent project not found",
      });
    }

    // First check: user must be in the project at all
    if (!checkProjectAccess(project, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You are not a member of this project.",
      });
    }

    // Second check: only task creator OR project owner can delete
    const isTaskCreator  = task.createdBy.toString() === req.user._id.toString();
    const isProjectOwner = project.createdBy.toString() === req.user._id.toString();

    if (!isTaskCreator && !isProjectOwner) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only the task creator or project owner can delete this task.",
      });
    }

    await task.deleteOne();

    res.status(200).json({
      success: true,
      message: "Task deleted successfully",
      deletedTaskId: req.params.id,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid task ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Server error while deleting task",
    });
  }
};

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
  deleteTask,
};
