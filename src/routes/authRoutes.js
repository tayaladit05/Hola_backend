const express = require('express');
const router = express.Router();
const authController = require('../Controllers/authcontroller');
const { googleAuth, googleCallback, verifyGoogleToken } = require('../Controllers/googleAuthController');

// Auth Routes
// POST /api/auth/register - Register user and send OTP
router.post('/register', authController.register);

// POST /api/auth/login - Login user (requires email verification)
router.post('/login', authController.login);

// POST /api/auth/verify-otp - Verify OTP and complete registration
router.post('/verify-otp', authController.verifyOTP);

// POST /api/auth/resend-otp - Resend OTP
router.post('/resend-otp', authController.resendOTP);

// Google OAuth Routes
// GET /api/auth/google - Initiate Google OAuth
router.get('/google', googleAuth);

// GET /api/auth/google/callback - Google OAuth callback
router.get('/google/callback', googleCallback);

// POST /api/auth/google/verify - Verify Google token (for mobile apps)
router.post('/google/verify', verifyGoogleToken);

module.exports = router;