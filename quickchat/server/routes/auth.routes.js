const express = require('express');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const presence = require('../presence');
const { validateUsername, validateDisplayName, normalizeUsername } = require('../utils/username');
const { signToken } = require('../utils/token');
const { asyncHandler, HttpError } = require('../middleware/error');
const { requireAuth } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const { serializeSelfUser } = require('../utils/serialize');
const { validateSecretKey } = require('../utils/secretKey');

const router = express.Router();

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many attempts, please try again later',
});

const BCRYPT_ROUNDS = 12;

function publicProfile(user) {
  return serializeSelfUser(user, presence.isOnline(user._id));
}

router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { username, error: usernameError } = validateUsername(req.body && req.body.username);

    if (usernameError) {
      throw new HttpError(400, usernameError, 'INVALID_USERNAME');
    }

    const { displayName, error: displayError } = validateDisplayName(req.body && req.body.displayName);

    if (displayError) {
      throw new HttpError(400, displayError, 'INVALID_DISPLAY_NAME');
    }

    const password = req.body && req.body.password;

    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      throw new HttpError(400, 'password must be 8-128 characters', 'INVALID_PASSWORD');
    }

    const { secretKey, error: secretKeyError } = validateSecretKey(
      req.body && req.body.secretKey
    );

    if (secretKeyError) {
      throw new HttpError(400, secretKeyError, 'INVALID_SECRET_KEY');
    }

    const existing = await User.findOne({ username });

    if (existing) {
      throw new HttpError(409, 'That username is already taken', 'USERNAME_TAKEN');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const secretKeyHash = await bcrypt.hash(secretKey, BCRYPT_ROUNDS);

    try {
      const user = await User.create({
        username,
        displayName,
        passwordHash,
        secretKeyHash,
        hasSecretKey: true,
        notepadModeEnabled: true,
      });

      return res.status(201).json({ token: signToken(user._id), user: publicProfile(user) });
    } catch (err) {
      if (err && err.code === 11000) {
        throw new HttpError(409, 'That username is already taken', 'USERNAME_TAKEN');
      }

      throw err;
    }
  })
);

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const username = normalizeUsername(req.body && req.body.username);
    const password = req.body && req.body.password;

    if (!username || typeof password !== 'string') {
      throw new HttpError(401, 'Invalid username or password', 'INVALID_CREDENTIALS');
    }

    const user = await User.findOne({ username }).select('+passwordHash');

    const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!ok) {
      throw new HttpError(401, 'Invalid username or password', 'INVALID_CREDENTIALS');
    }

    return res.json({ token: signToken(user._id), user: publicProfile(user) });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    return res.json({ user: publicProfile(req.user) });
  })
);

router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { displayName, error } = validateDisplayName(req.body && req.body.displayName);

    if (error) {
      throw new HttpError(400, error, 'INVALID_DISPLAY_NAME');
    }

    req.user.displayName = displayName;
    await req.user.save();

    return res.json({ user: publicProfile(req.user) });
  })
);

module.exports = router;
