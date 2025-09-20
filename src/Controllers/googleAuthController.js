const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const User = require('../Models/User');

// Configure Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists with this Google ID
    let user = await User.findOne({ googleId: profile.id });
    
    if (user) {
      // Update last login
      user.lastLogin = new Date();
      await user.save();
      return done(null, user);
    }
    
    // Check if user exists with the same email
    user = await User.findOne({ email: profile.emails[0].value });
    
    if (user) {
      // Link Google account to existing user
      user.googleId = profile.id;
      user.isEmailVerified = true; // Google emails are pre-verified
      user.lastLogin = new Date();
      if (!user.profilePicture && profile.photos[0]) {
        user.profilePicture = profile.photos[0].value;
      }
      await user.save();
      return done(null, user);
    }
    
    // Create new user
    const newUser = await User.create({
      googleId: profile.id,
      username: generateUniqueUsername(profile.displayName || profile.emails[0].value),
      email: profile.emails[0].value,
      fullName: profile.displayName || profile.emails[0].value.split('@')[0],
      profilePicture: profile.photos[0]?.value || '',
      isEmailVerified: true, // Google emails are pre-verified
      lastLogin: new Date()
    });
    
    return done(null, newUser);
    
  } catch (error) {
    console.error('Google OAuth error:', error);
    return done(error, null);
  }
}));

// Generate unique username from display name or email
const generateUniqueUsername = async (displayName) => {
  const baseUsername = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 15);
  
  let username = baseUsername;
  let counter = 1;
  
  while (await User.findOne({ username })) {
    username = `${baseUsername}${counter}`;
    counter++;
  }
  
  return username;
};

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth login initiation
exports.googleAuth = passport.authenticate('google', {
  scope: ['profile', 'email']
});

// Google OAuth callback handler
exports.googleCallback = (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, user, info) => {
    if (err) {
      console.error('Google callback error:', err);
      return res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`);
    }
    
    if (!user) {
      return res.redirect(`${process.env.CLIENT_URL}/login?error=auth_cancelled`);
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Redirect to frontend with token
    res.redirect(`${process.env.CLIENT_URL}/auth/success?token=${token}`);
    
  })(req, res, next);
};

// Manual Google token verification (for mobile apps)
exports.verifyGoogleToken = async (req, res) => {
  try {
    const { googleToken } = req.body;
    
    if (!googleToken) {
      return res.status(400).json({ message: 'Google token is required' });
    }
    
    // Verify Google token
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    
    const ticket = await client.verifyIdToken({
      idToken: googleToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;
    
    // Check if user exists
    let user = await User.findOne({ 
      $or: [
        { googleId },
        { email }
      ]
    });
    
    if (user) {
      // Update user data if needed
      if (!user.googleId) {
        user.googleId = googleId;
      }
      user.isEmailVerified = true;
      user.lastLogin = new Date();
      if (!user.profilePicture && picture) {
        user.profilePicture = picture;
      }
      await user.save();
    } else {
      // Create new user
      user = await User.create({
        googleId,
        username: await generateUniqueUsername(name || email),
        email,
        fullName: name || email.split('@')[0],
        profilePicture: picture || '',
        isEmailVerified: true,
        lastLogin: new Date()
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      message: 'Google authentication successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        profilePicture: user.profilePicture,
        isEmailVerified: user.isEmailVerified
      }
    });
    
  } catch (error) {
    console.error('Google token verification error:', error);
    res.status(401).json({ message: 'Invalid Google token' });
  }
};

// Export passport configuration for server.js
module.exports.passport = passport;