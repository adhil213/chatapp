const mongoose = require('mongoose');

const User = require('../models/User');
const { verifyToken, extractBearer } = require('../utils/token');

function unauthorized(res, message = 'Authentication required') {
  return res.status(401).json({ message, code: 'UNAUTHORIZED' });
}

async function requireAuth(req, res, next) {
  const token = extractBearer(req.headers.authorization);
  const userId = verifyToken(token);

  if (!userId || !mongoose.isValidObjectId(userId)) {
    return unauthorized(res);
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return unauthorized(res, 'Account not found');
    }

    req.userId = String(user._id);
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireAuth, unauthorized };
