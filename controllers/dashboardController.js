const Task = require("../models/Task");
const Project = require("../models/Project");

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────
// The dashboard gives the logged-in user a bird's-eye view of their work.
// All data is scoped to the current user — they only see their own stats.
//
// "User's tasks" means:
//   Tasks they CREATED  (createdBy === userId)
//   OR tasks ASSIGNED to them (assignedTo === userId)
//
// "User's projects" means:
//   Projects they CREATED (createdBy === userId)
//   OR projects they are a MEMBER of (members contains userId)
//
// Performance strategy:
//   We use Promise.all() to run all DB queries IN PARALLEL.
//   Without it: query1 → wait → query2 → wait → query3 → wait (slow, sequential)
//   With it:    query1 + query2 + query3 all run at the same time (fast)
//
// MongoDB Aggregation Pipeline:
//   A pipeline is a series of stages that transform documents step by step.
//   Think of it like an assembly line:
//     Stage 1 ($match)  → filter documents (like a WHERE clause in SQL)
//     Stage 2 ($group)  → group and count (like GROUP BY in SQL)
//     Stage 3 ($sort)   → sort results
//     Stage 4 ($lookup) → join with another collection (like JOIN in SQL)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — buildUserTaskFilter
// ─────────────────────────────────────────────────────────────────────────────
// Returns the base MongoDB filter for "tasks belonging to this user".
// Reused across multiple queries to keep things DRY (Don't Repeat Yourself).
// ─────────────────────────────────────────────────────────────────────────────

const buildUserTaskFilter = (userId) => ({
  $or: [
    { createdBy: userId },
    { assignedTo: userId },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — buildUserProjectFilter
// ─────────────────────────────────────────────────────────────────────────────
// Returns the base MongoDB filter for "projects belonging to this user".
// ─────────────────────────────────────────────────────────────────────────────

const buildUserProjectFilter = (userId) => ({
  $or: [
    { createdBy: userId },
    { members: userId },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — normalizeAggregationResult
// ─────────────────────────────────────────────────────────────────────────────
// MongoDB aggregation $group returns an array like:
//   [ { _id: "todo", count: 5 }, { _id: "done", count: 3 } ]
//
// This helper converts it to a clean object:
//   { todo: 5, done: 3 }
//
// It also fills in missing keys with 0 using the defaultKeys array.
// For example, if no tasks have status "review", it still shows review: 0
// instead of just omitting it — which would confuse the frontend.
//
// @param {Array}  aggregationResult - raw result from $group stage
// @param {Array}  defaultKeys       - all possible keys (to fill missing ones with 0)
// @returns {Object}
// ─────────────────────────────────────────────────────────────────────────────

const normalizeAggregationResult = (aggregationResult, defaultKeys) => {
  // Start with all keys set to 0
  const normalized = defaultKeys.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});

  // Fill in actual counts from the aggregation result
  aggregationResult.forEach(({ _id, count }) => {
    if (_id) normalized[_id] = count;
  });

  return normalized;
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get complete dashboard stats for the logged-in user
// @route   GET /api/dashboard
// @access  Private (requires JWT token)
// ─────────────────────────────────────────────────────────────────────────────

const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const now    = new Date(); // current timestamp for overdue calculation

    // Build reusable filters
    const taskFilter    = buildUserTaskFilter(userId);
    const projectFilter = buildUserProjectFilter(userId);

    // ─────────────────────────────────────────────────────────────────────
    // RUN ALL QUERIES IN PARALLEL WITH Promise.all
    // ─────────────────────────────────────────────────────────────────────
    // Each item in the array is a separate DB query.
    // Promise.all fires them all at the same time and waits for ALL to finish.
    // The results come back in the same order as the queries.
    //
    // Estimated time saved:
    //   Sequential: ~800ms (8 queries × ~100ms each)
    //   Parallel:   ~100ms (all run at the same time)
    // ─────────────────────────────────────────────────────────────────────

    const [
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasks,
      totalProjects,
      tasksByStatus,
      tasksByPriority,
      recentTasks,
      recentProjects,
      projectsWithTaskCount,
    ] = await Promise.all([

      // ── 1. Total tasks (created by OR assigned to user) ─────────────────
      Task.countDocuments(taskFilter),

      // ── 2. Completed tasks (status === "done") ───────────────────────────
      Task.countDocuments({ ...taskFilter, status: "done" }),

      // ── 3. Pending tasks (status is NOT "done") ──────────────────────────
      // $ne = "not equal" operator
      Task.countDocuments({ ...taskFilter, status: { $ne: "done" } }),

      // ── 4. Overdue tasks ─────────────────────────────────────────────────
      // Definition: dueDate exists AND dueDate < now AND status !== "done"
      // $lt = "less than" operator
      // $ne = "not equal" operator
      // $ne: null means "dueDate must exist (not be null)"
      Task.countDocuments({
        ...taskFilter,
        dueDate: {
          $ne: null,   // must have a due date set
          $lt: now,    // due date is in the past
        },
        status: { $ne: "done" }, // not already completed
      }),

      // ── 5. Total projects (owned or member of) ───────────────────────────
      Project.countDocuments(projectFilter),

      // ── 6. Tasks grouped by status (aggregation pipeline) ────────────────
      // This is a MongoDB Aggregation Pipeline with 2 stages:
      //
      // Stage 1: $match — filter documents (same as .find())
      //   Only include tasks that belong to this user
      //
      // Stage 2: $group — group documents by a field and count them
      //   _id: "$status" means "group by the status field"
      //   count: { $sum: 1 } means "add 1 for each document in the group"
      //
      // Result: [ { _id: "todo", count: 5 }, { _id: "done", count: 3 }, ... ]
      Task.aggregate([
        { $match: taskFilter },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } }, // sort alphabetically for consistent order
      ]),

      // ── 7. Tasks grouped by priority (aggregation pipeline) ──────────────
      // Same pattern as above but grouping by priority instead of status
      Task.aggregate([
        { $match: taskFilter },
        {
          $group: {
            _id: "$priority",
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // ── 8. Recent tasks (last 5 updated) ─────────────────────────────────
      // Sort by updatedAt descending = most recently modified first
      // populate() replaces ObjectId references with actual document data
      Task.find(taskFilter)
        .populate("project", "title status")
        .populate("assignedTo", "name email")
        .sort({ updatedAt: -1 })
        .limit(5)
        .select("title status priority dueDate project assignedTo updatedAt"),
        // .select() limits which fields are returned — keeps response lean

      // ── 9. Recent projects (last 5 created) ──────────────────────────────
      Project.find(projectFilter)
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .limit(5)
        .select("title status deadline createdBy createdAt"),

      // ── 10. Per-project task count (aggregation with $lookup) ─────────────
      // This is a more advanced pipeline that:
      //   Stage 1: $match  — get only user's projects
      //   Stage 2: $lookup — JOIN with tasks collection (like SQL JOIN)
      //   Stage 3: $addFields — add a computed taskCount field
      //   Stage 4: $project — shape the output (pick which fields to return)
      //   Stage 5: $sort   — newest projects first
      //   Stage 6: $limit  — only top 5 projects
      //
      // $lookup explanation:
      //   from: "tasks"         → join with the tasks collection
      //   localField: "_id"     → use Project._id
      //   foreignField: "project" → match against Task.project
      //   as: "taskList"        → store matched tasks in a temp array "taskList"
      Project.aggregate([
        {
          $match: projectFilter,
        },
        {
          // $lookup = LEFT JOIN in SQL
          // "For each project, find all tasks where task.project === project._id"
          $lookup: {
            from: "tasks",          // collection name (lowercase plural)
            localField: "_id",      // Project._id
            foreignField: "project", // Task.project
            as: "taskList",         // temporary field name for matched tasks
          },
        },
        {
          // $addFields adds new computed fields to each document
          $addFields: {
            taskCount: { $size: "$taskList" },
            // $size counts the number of elements in the taskList array
            completedTaskCount: {
              // $filter creates a subset of the array matching a condition
              // then $size counts how many passed the filter
              $size: {
                $filter: {
                  input: "$taskList",
                  as: "task",
                  cond: { $eq: ["$$task.status", "done"] },
                  // $$task refers to each element in the taskList array
                  // $eq checks if task.status equals "done"
                },
              },
            },
          },
        },
        {
          // $project shapes the output — only include what we need
          // MongoDB rule: ya sirf inclusions (1) use karo, ya sirf exclusions (0)
          // Dono ek saath nahi — isliye taskList ko include nahi karte
          $project: {
            title: 1,
            status: 1,
            deadline: 1,
            createdAt: 1,
            taskCount: 1,
            completedTaskCount: 1,
            // taskList: 0  ← YE REMOVE KIYA — inclusion ke saath exclusion nahi chalta
          },
        },
        { $sort: { createdAt: -1 } },
        { $limit: 5 },
      ]),
    ]);

    // ─────────────────────────────────────────────────────────────────────
    // NORMALIZE AGGREGATION RESULTS
    // ─────────────────────────────────────────────────────────────────────
    // Convert raw aggregation arrays into clean objects with all keys present.
    // This ensures the frontend always gets a consistent shape.
    //
    // Raw:      [ { _id: "todo", count: 5 }, { _id: "done", count: 2 } ]
    // Normalized: { todo: 5, "in-progress": 0, review: 0, done: 2 }
    // ─────────────────────────────────────────────────────────────────────

    const statusBreakdown = normalizeAggregationResult(tasksByStatus, [
      "todo",
      "in-progress",
      "review",
      "done",
    ]);

    const priorityBreakdown = normalizeAggregationResult(tasksByPriority, [
      "low",
      "medium",
      "high",
    ]);

    // ─────────────────────────────────────────────────────────────────────
    // BUILD FINAL RESPONSE
    // ─────────────────────────────────────────────────────────────────────

    res.status(200).json({
      success: true,
      data: {

        // ── Summary Counts ───────────────────────────────────────────────
        summary: {
          totalTasks,
          completedTasks,
          pendingTasks,
          overdueTasks,
          totalProjects,
          // Completion rate as a percentage (0 if no tasks)
          completionRate:
            totalTasks > 0
              ? Math.round((completedTasks / totalTasks) * 100)
              : 0,
        },

        // ── Task Breakdowns ──────────────────────────────────────────────
        // Clean objects — frontend can directly read statusBreakdown.todo
        tasksByStatus: statusBreakdown,
        tasksByPriority: priorityBreakdown,

        // ── Recent Activity ──────────────────────────────────────────────
        recentTasks,
        recentProjects,

        // ── Per-Project Stats ────────────────────────────────────────────
        projectsWithTaskCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error while fetching dashboard data",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get task activity for the last 7 days (for a chart/graph)
// @route   GET /api/dashboard/activity
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
// Returns how many tasks were created each day for the past 7 days.
// Useful for rendering a bar chart or line graph on the frontend.
//
// Aggregation stages:
//   $match   → only user's tasks created in the last 7 days
//   $group   → group by date (year + month + day), count tasks per day
//   $sort    → oldest to newest (left to right on a chart)
// ─────────────────────────────────────────────────────────────────────────────

const getActivityStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // Calculate the date 7 days ago from right now
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const taskFilter = buildUserTaskFilter(userId);

    const [taskActivity, statusTrend] = await Promise.all([

      // ── Tasks created per day (last 7 days) ──────────────────────────────
      Task.aggregate([
        {
          $match: {
            ...taskFilter,
            createdAt: { $gte: sevenDaysAgo }, // $gte = "greater than or equal"
          },
        },
        {
          $group: {
            // Group by the date portion of createdAt (ignore time)
            // $dateToString formats a Date object as a string
            // format: "%Y-%m-%d" → "2025-05-23"
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
              },
            },
            tasksCreated: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } }, // oldest date first (left to right on chart)
      ]),

      // ── Tasks completed per day (last 7 days) ────────────────────────────
      Task.aggregate([
        {
          $match: {
            ...taskFilter,
            status: "done",
            updatedAt: { $gte: sevenDaysAgo },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$updatedAt",
              },
            },
            tasksCompleted: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // ─────────────────────────────────────────────────────────────────────
    // MERGE created and completed into one array by date
    // ─────────────────────────────────────────────────────────────────────
    // We want: [ { date: "2025-05-17", created: 3, completed: 1 }, ... ]
    // But the two aggregations return separate arrays.
    // We merge them using a Map (key = date string).
    // ─────────────────────────────────────────────────────────────────────

    // Build a map of all 7 days with default values
    const activityMap = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0]; // "2025-05-23"
      activityMap[dateStr] = { date: dateStr, created: 0, completed: 0 };
    }

    // Fill in created counts
    taskActivity.forEach(({ _id, tasksCreated }) => {
      if (activityMap[_id]) activityMap[_id].created = tasksCreated;
    });

    // Fill in completed counts
    statusTrend.forEach(({ _id, tasksCompleted }) => {
      if (activityMap[_id]) activityMap[_id].completed = tasksCompleted;
    });

    // Convert map to sorted array
    const activity = Object.values(activityMap);

    res.status(200).json({
      success: true,
      data: {
        activity,
        // Summary for the 7-day period
        period: {
          from: sevenDaysAgo.toISOString().split("T")[0],
          to: new Date().toISOString().split("T")[0],
          totalCreated: activity.reduce((sum, d) => sum + d.created, 0),
          totalCompleted: activity.reduce((sum, d) => sum + d.completed, 0),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error while fetching activity data",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get overdue tasks list (not just count)
// @route   GET /api/dashboard/overdue
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
// Returns the actual overdue task documents (not just a count).
// Sorted by dueDate ascending = most overdue tasks first.
// ─────────────────────────────────────────────────────────────────────────────

const getOverdueTasks = async (req, res) => {
  try {
    const userId = req.user._id;
    const now    = new Date();

    const overdueTasks = await Task.find({
      ...buildUserTaskFilter(userId),
      dueDate: { $ne: null, $lt: now },
      status: { $ne: "done" },
    })
      .populate("project", "title status")
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .sort({ dueDate: 1 }) // most overdue (oldest due date) first
      .select("title status priority dueDate project assignedTo createdBy");

    // Calculate how many days overdue each task is
    const tasksWithOverdueDays = overdueTasks.map((task) => {
      const taskObj = task.toObject(); // convert Mongoose doc to plain JS object
      const diffMs  = now - new Date(task.dueDate); // difference in milliseconds
      taskObj.daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      // 1000ms × 60s × 60min × 24hr = milliseconds in one day
      return taskObj;
    });

    res.status(200).json({
      success: true,
      count: tasksWithOverdueDays.length,
      data: tasksWithOverdueDays,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error while fetching overdue tasks",
    });
  }
};

module.exports = {
  getDashboardStats,
  getActivityStats,
  getOverdueTasks,
};
