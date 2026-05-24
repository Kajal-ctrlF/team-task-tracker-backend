const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// ─────────────────────────────────────────────────────────────────────────────
// USER SCHEMA
// ─────────────────────────────────────────────────────────────────────────────
// A Mongoose schema defines the shape of documents in MongoDB.
// Think of it like a blueprint — every user document must follow this structure.
// ─────────────────────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,                                    // removes leading/trailing spaces
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,                                  // no two users can share an email
      lowercase: true,                               // always stored as lowercase
      trim: true,
      match: [
        /^\S+@\S+\.\S+$/,
        "Please enter a valid email address",
      ],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
      // ↑ IMPORTANT: select: false means this field is NEVER returned
      // in any query result unless you explicitly ask for it with .select("+password")
      // This prevents accidentally leaking passwords in API responses
    },

    role: {
      type: String,
      enum: ["admin", "member"],  // only these two values are allowed
      default: "member",
    },

    avatar: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    // ↑ Mongoose automatically adds two fields:
    //   createdAt — when the document was first created
    //   updatedAt — when the document was last modified
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PRE-SAVE HOOK — Hash password before storing
// ─────────────────────────────────────────────────────────────────────────────
// This runs automatically BEFORE every .save() call.
// We never store plain-text passwords. bcrypt turns "mypassword123"
// into something like "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
// which is a one-way hash — it cannot be reversed back to the original.
// ─────────────────────────────────────────────────────────────────────────────

userSchema.pre("save", async function (next) {
  // Skip hashing if the password field wasn't changed
  // (e.g., when updating name or avatar — we don't want to re-hash)
  if (!this.isModified("password")) return next();

  // genSalt(10) — the "10" is the cost factor (salt rounds)
  // Higher = more secure but slower. 10 is the industry standard.
  const salt = await bcrypt.genSalt(10);

  // Replace the plain-text password with the hashed version
  this.password = await bcrypt.hash(this.password, salt);

  next(); // continue saving
});

// ─────────────────────────────────────────────────────────────────────────────
// INSTANCE METHOD — Compare entered password with stored hash
// ─────────────────────────────────────────────────────────────────────────────
// bcrypt.compare() hashes the entered password with the same salt
// and checks if the result matches the stored hash.
// Returns true if they match, false otherwise.
// ─────────────────────────────────────────────────────────────────────────────

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
// ↑ This creates a "users" collection in MongoDB (Mongoose pluralizes the name)
