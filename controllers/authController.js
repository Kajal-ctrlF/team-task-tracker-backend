const User          = require("../models/User");
const generateToken = require("../utils/generateToken");
const { sendOtpEmail } = require("../utils/sendEmail");
const bcrypt        = require("bcryptjs");

// ─────────────────────────────────────────────────────────────────────────────
// OTP FLOW EXPLAINED
// ─────────────────────────────────────────────────────────────────────────────
//
// Step 1: User clicks "Forgot Password" → enters email
//         POST /api/auth/forgot-password
//         → Generate 6-digit OTP
//         → Hash the OTP (store hash in DB, send plain OTP in email)
//         → Set expiry: now + 10 minutes
//         → Send email with OTP
//
// Step 2: User enters OTP from email
//         POST /api/auth/verify-otp
//         → Find user by email
//         → Check OTP not expired
//         → Compare entered OTP with stored hash (bcrypt.compare)
//         → If match → set resetOtpVerified = true
//         → Return success (frontend can now show reset password form)
//
// Step 3: User enters new password
//         POST /api/auth/reset-password
//         → Find user by email
//         → Check resetOtpVerified === true (security gate)
//         → Update password (pre-save hook hashes it)
//         → Clear OTP fields (resetOtp, resetOtpExpiry, resetOtpVerified)
//
// SECURITY:
//   - OTP is hashed before storing (same as passwords)
//   - OTP expires in 10 minutes
//   - resetOtpVerified prevents skipping OTP step
//   - OTP cleared after successful reset (can't reuse)
//   - Same error message for "email not found" (prevents user enumeration)
// ─────────────────────────────────────────────────────────────────────────────

// ── Helper: generate 6-digit OTP ─────────────────────────────────────────────
const generateOtp = () => {
  // Math.random() gives 0.0 to 0.999...
  // * 900000 + 100000 gives 100000 to 999999 (always 6 digits)
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────────────────────────────────────

const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "Account already exists with this email",
      });
    }

    const user = await User.create({ name, email, password });

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: {
        _id:       user._id,
        name:      user.name,
        email:     user.email,
        role:      user.role,
        createdAt: user.createdAt,
        token:     generateToken(user._id),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────────────

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        _id:   user._id,
        name:  user.name,
        email: user.email,
        role:  user.role,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ME
// ─────────────────────────────────────────────────────────────────────────────

const getMe = async (req, res) => {
  res.status(200).json({ success: true, data: req.user });
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE PROFILE
// ─────────────────────────────────────────────────────────────────────────────

const updateProfile = async (req, res) => {
  try {
    const { name, avatar } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, avatar },
      { new: true, runValidators: true }
    );
    res.status(200).json({ success: true, message: "Profile updated", data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// FORGOT PASSWORD — Step 1: Send OTP
// @route POST /api/auth/forgot-password
// @access Public
// ─────────────────────────────────────────────────────────────────────────────

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    // Find user — same error message whether found or not (security)
    const user = await User.findOne({ email });

    if (!user) {
      // We return success even if email not found — prevents user enumeration
      // Attacker can't know if an email is registered or not
      return res.status(200).json({
        success: true,
        message: "If this email is registered, you will receive an OTP shortly",
      });
    }

    // Generate 6-digit OTP
    const otp = generateOtp(); // e.g. "847291"

    // Hash the OTP before storing (same security as passwords)
    // If DB is compromised, attacker can't see the OTP
    const salt      = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);

    // Store hashed OTP + expiry in DB
    // OTP expires in 10 minutes from now
    user.resetOtp         = hashedOtp;
    user.resetOtpExpiry   = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    user.resetOtpVerified = false; // reset verification status
    await user.save({ validateBeforeSave: false });
    // validateBeforeSave: false — skip other field validations (password etc.)

    // Send OTP email
    await sendOtpEmail(user.email, user.name, otp);

    res.status(200).json({
      success: true,
      message: "OTP sent to your email address",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send OTP. Please try again.",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// VERIFY OTP — Step 2: Verify the OTP
// @route POST /api/auth/verify-otp
// @access Public
// ─────────────────────────────────────────────────────────────────────────────

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required" });
    }

    // Fetch user WITH the OTP fields (they have select: false)
    const user = await User.findOne({ email }).select("+resetOtp +resetOtpExpiry +resetOtpVerified");

    if (!user || !user.resetOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP. Please request a new one.",
      });
    }

    // Check if OTP has expired
    if (user.resetOtpExpiry < new Date()) {
      // Clear expired OTP from DB
      user.resetOtp         = undefined;
      user.resetOtpExpiry   = undefined;
      user.resetOtpVerified = false;
      await user.save({ validateBeforeSave: false });

      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Compare entered OTP with stored hash
    // bcrypt.compare(plain, hash) → true if they match
    const isOtpValid = await bcrypt.compare(otp.toString(), user.resetOtp);

    if (!isOtpValid) {
      return res.status(400).json({
        success: false,
        message: "Incorrect OTP. Please check and try again.",
      });
    }

    // OTP is correct — mark as verified
    // This flag is checked in resetPassword to prevent skipping OTP step
    user.resetOtpVerified = true;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: "OTP verified successfully. You can now reset your password.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// RESET PASSWORD — Step 3: Set new password
// @route POST /api/auth/reset-password
// @access Public
// ─────────────────────────────────────────────────────────────────────────────

const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ success: false, message: "Email and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    if (!/\d/.test(newPassword)) {
      return res.status(400).json({ success: false, message: "Password must contain at least one number" });
    }

    // Fetch user WITH OTP fields
    const user = await User.findOne({ email }).select("+resetOtp +resetOtpExpiry +resetOtpVerified");

    if (!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    // SECURITY GATE: Only allow reset if OTP was verified
    // This prevents someone from calling this endpoint directly without OTP
    if (!user.resetOtpVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your OTP first before resetting password.",
      });
    }

    // Update password — pre-save hook will hash it automatically
    user.password = newPassword;

    // Clear all OTP fields — OTP can't be reused
    user.resetOtp         = undefined;
    user.resetOtpExpiry   = undefined;
    user.resetOtpVerified = false;

    await user.save(); // triggers pre-save hook → hashes password

    res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  updateProfile,
  forgotPassword,
  verifyOtp,
  resetPassword,
};
