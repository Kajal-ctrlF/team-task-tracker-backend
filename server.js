// Load environment variables FIRST before anything else
require("dotenv").config();

// express-async-errors patches Express so async errors are automatically
// forwarded to the error handler — no need for try/catch in every controller
require("express-async-errors");

const express = require("express");
const cors    = require("cors");
const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

// ─── Connect to MongoDB ───────────────────────────────────────────────────────
connectDB();

// ─── Initialize Express App ───────────────────────────────────────────────────
const app = express();

// ─── CORS Configuration ───────────────────────────────────────────────────────
// CORS = Cross-Origin Resource Sharing
// Browser blocks requests from one domain to another by default.
// We must explicitly allow our frontend URL to call our backend.
//
// In development: frontend is at http://localhost:3000
// In production:  frontend is at https://your-app.vercel.app
//
// CLIENT_URL env variable holds the allowed frontend URL.
// We support multiple origins (localhost + vercel) using an array.

const allowedOrigins = [
  "http://localhost:3000",                          // local development
  process.env.CLIENT_URL,                           // production Vercel URL
].filter(Boolean); // remove undefined/null values

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (Postman, mobile apps, curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);  // origin is allowed
      } else {
        callback(new Error(`CORS blocked: ${origin} not allowed`));
      }
    },
    credentials: true, // allow cookies and Authorization headers
  })
);

// ─── Core Middleware ──────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ─── Health Check Route ───────────────────────────────────────────────────────
// Render uses this to check if the server is alive
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Team Task Tracker API is running 🚀",
    version: "1.0.0",
    environment: process.env.NODE_ENV,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth",      require("./routes/authRoutes"));
app.use("/api/projects",  require("./routes/projectRoutes"));
app.use("/api/tasks",     require("./routes/taskRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));

// ─── Error Handling Middleware ────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
