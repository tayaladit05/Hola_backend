const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: function() { return !this.googleId; } }, // Password not required for Google users
  fullName: { type: String, required: true },
  bio: { type: String, maxLength: 150 },
  profilePicture: { type: String, default: '' },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  posts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  isVerified: { type: Boolean, default: false },
  
  // Email verification fields
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationOTP: { type: String },
  otpExpires: { type: Date },
  
  // Google OAuth fields
  googleId: { type: String, unique: true, sparse: true },
  
  // Password reset fields
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },
  
  // Account status
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
