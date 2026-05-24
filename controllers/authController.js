const User = require("../models/User");
const generateToken = require("../utils/generateToken");

// ─────────────────────────────────────────────────────────────────────────────
// AUTH CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────
// Controllers contain the actual business logic for each route.
// They receive (req, res) from Express and send back a JSON response.
//
// We use express-async-errors (loaded in server.js) so we can throw errors
// directly without wrapping everything in try/catch.
// Any thrown error is automatically caught and forwarded to errorMiddleware.js
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public (no token needed)
 *
 * Flow:
 *   1. Validation runs first (via registerRules + handleValidation in route)
 *   2. Check if email is already taken
 *   3. Create user — password is hashed automatically by the pre-save hook
 *   4. Return user data + JWT token
 */
const registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  // Step 1: Check if a user with this email already exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400); // Bad Request
    throw new Error("An account with this email already exists");
  }

  // Step 2: Create the user
  // The password is NOT stored as plain text here.
  // The pre-save hook in User.js intercepts this and hashes it first.
  const user = await User.create({ name, email, password });

  // Step 3: Respond with user info + token
  // We manually pick which fields to return — never return the password
  res.status(201).json({
    success: true,
    message: "Account created successfully",
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      token: generateToken(user._id),
      // ↑ The client should store this token and send it with every
      //   protected request in the Authorization header
    },
  });
};

/**
 * @desc    Login user and return JWT token
 * @route   POST /api/auth/login
 * @access  Public (no token needed)
 *
 * Flow:
 *   1. Validation runs first (via loginRules + handleValidation in route)
 *   2. Find user by email — include password (it's excluded by default)
 *   3. Compare entered password with stored hash using bcrypt
 *   4. If match → return user data + new JWT token
 *   5. If no match → return 401 Unauthorized
 *
 * Security note: We return the same error message for "user not found"
 * and "wrong password" on purpose. This prevents attackers from knowing
 * whether an email is registered or not (user enumeration attack).
 */
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  // Find user by email
  // .select("+password") overrides the schema's select:false
  // so we can access the hashed password for comparison
  const user = await User.findOne({ email }).select("+password");

  // Check user exists AND password matches
  // We do both checks in one condition to avoid leaking which one failed
  if (!user || !(await user.matchPassword(password))) {
    res.status(401); // Unauthorized
    throw new Error("Invalid email or password");
  }

  // Login successful — return user data + fresh token
  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    },
  });
};

/**
 * @desc    Get the currently logged-in user's profile
 * @route   GET /api/auth/me
 * @access  Private (requires valid JWT)
 *
 * The protect middleware runs before this and attaches the user
 * to req.user — so we just return it directly.
 */
const getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    data: req.user,
    // req.user is set by the protect middleware
    // It's the full user document (minus password)
  });
};

/**
 * @desc    Update logged-in user's profile (name or avatar)
 * @route   PUT /api/auth/me
 * @access  Private (requires valid JWT)
 */
const updateProfile = async (req, res) => {
  const { name, avatar } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name, avatar },
    {
      new: true,           // return the updated document, not the old one
      runValidators: true, // run schema validators on the updated fields
    }
  );

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: user,
  });
};

module.exports = { registerUser, loginUser, getMe, updateProfile };
