/**
 * notFound
 * Catches requests to routes that don't exist
 * Returns a 404 error
 */
const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  res.status(404);
  next(error); // Pass to errorHandler
};

/**
 * errorHandler
 * Global error handler — catches ALL errors thrown anywhere in the app
 * Must have 4 parameters (err, req, res, next) for Express to treat it as error middleware
 */
const errorHandler = (err, req, res, next) => {
  // Sometimes an error is thrown with status 200 by default — fix that
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // Mongoose: bad ObjectId (e.g. /api/tasks/not-a-valid-id)
  if (err.name === "CastError" && err.kind === "ObjectId") {
    statusCode = 404;
    message = "Resource not found (invalid ID)";
  }

  // Mongoose: duplicate key (e.g. email already exists)
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `${field} already exists`;
  }

  // Mongoose: validation error
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Show stack trace only in development mode
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

module.exports = { notFound, errorHandler };
