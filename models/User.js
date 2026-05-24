const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

// ─────────────────────────────────────────────────────────────────────────────
// USER SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },

    role: {
      type: String,
      enum: ["admin", "member"],
      default: "member",
    },

    avatar: {
      type: String,
      default: "",
    },

    // ── OTP Fields for Forgot Password ────────────────────────────────────
    // These fields are only populated when user requests a password reset.
    // After successful reset, they are cleared.
    //
    // resetOtp        — the 6-digit OTP (stored as hashed string for security)
    // resetOtpExpiry  — when the OTP expires (10 minutes from generation)
    // resetOtpVerified — true after user enters correct OTP (allows password reset)

    resetOtp: {
      type: String,
      select: false, // never returned in normal queries
    },

    resetOtpExpiry: {
      type: Date,
      select: false,
    },

    resetOtpVerified: {
      type: Boolean,
      default: false,
      select: false,
    },
  },
  { timestamps: true }
);

// ── Pre-save hook — hash password ─────────────────────────────────────────────
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ── Instance method — compare password ───────────────────────────────────────
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
