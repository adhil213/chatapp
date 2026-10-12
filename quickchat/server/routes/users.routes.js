const express = require('express');
const mongoose = require('mongoose');

const User = require('../models/User');
const presence = require('../presence');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/error');
const { createRateLimiter } = require('../middleware/rateLimit');
const { serializePublicUser } = require('../utils/serialize');
const { normalizeUsername } = require('../utils/username');
const { getRelationshipState } = require('../utils/relationship');

const router = express.Router();

const searchLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many searches, please slow down',
});

const MIN_QUERY = 2;
const MAX_RESULTS = 20;

router.get(
  '/search',
  requireAuth,
  searchLimiter,
  asyncHandler(async (req, res) => {
    const query = normalizeUsername(req.query.q);

    if (query.length < MIN_QUERY) {
      return res.json({ users: [] });
    }

    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const users = await User.find({
      username: { $regex: `^${escaped}` },
      _id: { $ne: req.userId },
    })
      .limit(MAX_RESULTS)
      .sort({ username: 1 });

    const results = [];

    for (const user of users) {
      const relationship = await getRelationshipState(req.userId, user._id);

      if (relationship === 'self') continue;

      results.push({
        ...serializePublicUser(user, presence.isOnline(user._id)),
        relationship,
      });
    }

    return res.json({ users: results });
  })
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new HttpError(400, 'Invalid user id', 'INVALID_USER');
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      throw new HttpError(404, 'User not found', 'NOT_FOUND');
    }

    const relationship = await getRelationshipState(req.userId, user._id);

    return res.json({
      user: { ...serializePublicUser(user, presence.isOnline(user._id)), relationship },
    });
  })
);

module.exports = router;
