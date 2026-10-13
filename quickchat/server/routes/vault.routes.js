const express = require('express');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const presence = require('../presence');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/error');
const { createRateLimiter } = require('../middleware/rateLimit');
const { serializeSelfUser } = require('../utils/serialize');
const { validateSecretKey } = require('../utils/secretKey');

const router = express.Router();

const BCRYPT_ROUNDS = 12;

const unlockLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: (req) => req.userId,
  message: 'Too many unlock attempts, please try again later',
});

const keyLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: (req) => req.userId,
  message: 'Too many attempts, please try again later',
});

const resetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  key: (req) => req.userId,
  message: 'Too many reset attempts, please try again later',
});

function selfProfile(user) {
  return serializeSelfUser(user, presence.isOnline(user._id));
}

router.post(
  '/unlock',
  requireAuth,
  unlockLimiter,
  asyncHandler(async (req, res) => {
    const secretKey = req.body && req.body.secretKey;

    if (typeof secretKey !== 'string' || secretKey.length === 0) {
      throw new HttpError(400, 'Secret key is required', 'INVALID_SECRET_KEY');
    }

    const user = await User.findById(req.userId).select('+secretKeyHash');

    if (!user || !user.hasSecretKey || !user.secretKeyHash) {
      throw new HttpError(400, 'No secret key is set for this account', 'SECRET_KEY_NOT_SET');
    }

    const ok = await bcrypt.compare(secretKey, user.secretKeyHash);

    if (!ok) {
      throw new HttpError(401, 'Incorrect secret key', 'INVALID_SECRET_KEY');
    }

    return res.json({ ok: true });
  })
);

router.post(
  '/secret-key',
  requireAuth,
  keyLimiter,
  asyncHandler(async (req, res) => {
    const { secretKey, error } = validateSecretKey(req.body && req.body.secretKey);

    if (error) {
      throw new HttpError(400, error, 'INVALID_SECRET_KEY');
    }

    const user = await User.findById(req.userId).select('+secretKeyHash');

    if (!user) {
      throw new HttpError(401, 'Authentication required', 'UNAUTHORIZED');
    }

    if (user.hasSecretKey) {
      throw new HttpError(409, 'A secret key is already set', 'SECRET_KEY_EXISTS');
    }

    user.secretKeyHash = await bcrypt.hash(secretKey, BCRYPT_ROUNDS);
    user.hasSecretKey = true;

    await user.save();

    return res.json({ user: selfProfile(user) });
  })
);

router.patch(
  '/secret-key',
  requireAuth,
  keyLimiter,
  asyncHandler(async (req, res) => {
    const currentSecretKey = req.body && req.body.currentSecretKey;
    const { secretKey, error } = validateSecretKey(req.body && req.body.newSecretKey);

    if (error) {
      throw new HttpError(400, error, 'INVALID_SECRET_KEY');
    }

    if (typeof currentSecretKey !== 'string' || currentSecretKey.length === 0) {
      throw new HttpError(400, 'Current secret key is required', 'INVALID_CURRENT_SECRET_KEY');
    }

    const user = await User.findById(req.userId).select('+secretKeyHash');

    if (!user) {
      throw new HttpError(401, 'Authentication required', 'UNAUTHORIZED');
    }

    if (!user.hasSecretKey || !user.secretKeyHash) {
      throw new HttpError(409, 'No secret key is set for this account', 'SECRET_KEY_NOT_SET');
    }

    const ok = await bcrypt.compare(currentSecretKey, user.secretKeyHash);

    if (!ok) {
      throw new HttpError(401, 'Current secret key is incorrect', 'INVALID_CURRENT_SECRET_KEY');
    }

    user.secretKeyHash = await bcrypt.hash(secretKey, BCRYPT_ROUNDS);
    user.hasSecretKey = true;

    await user.save();

    return res.json({ user: selfProfile(user) });
  })
);

router.post(
  '/reset',
  requireAuth,
  resetLimiter,
  asyncHandler(async (req, res) => {
    const password = req.body && req.body.password;
    const { secretKey, error } = validateSecretKey(req.body && req.body.secretKey);

    if (error) {
      throw new HttpError(400, error, 'INVALID_SECRET_KEY');
    }

    if (typeof password !== 'string' || password.length === 0) {
      throw new HttpError(400, 'Account password is required', 'INVALID_PASSWORD');
    }

    const user = await User.findById(req.userId).select('+passwordHash +secretKeyHash');

    if (!user || !user.passwordHash) {
      throw new HttpError(401, 'Authentication required', 'UNAUTHORIZED');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);

    if (!ok) {
      throw new HttpError(401, 'Account password is incorrect', 'INVALID_PASSWORD');
    }

    user.secretKeyHash = await bcrypt.hash(secretKey, BCRYPT_ROUNDS);
    user.hasSecretKey = true;

    await user.save();

    return res.json({ user: selfProfile(user) });
  })
);

router.patch(
  '/notepad-mode',
  requireAuth,
  keyLimiter,
  asyncHandler(async (req, res) => {
    const enabled = req.body && req.body.enabled;

    if (typeof enabled !== 'boolean') {
      throw new HttpError(400, 'enabled must be a boolean', 'INVALID_PAYLOAD');
    }

    const user = await User.findById(req.userId).select('+secretKeyHash');

    if (!user) {
      throw new HttpError(401, 'Authentication required', 'UNAUTHORIZED');
    }

    if (enabled && (!user.hasSecretKey || !user.secretKeyHash)) {
      throw new HttpError(400, 'Set a secret key before enabling notepad mode', 'SECRET_KEY_REQUIRED');
    }

    user.notepadModeEnabled = enabled;

    await user.save();

    return res.json({ user: selfProfile(user) });
  })
);

module.exports = router;
