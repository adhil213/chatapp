const jwt = require('jsonwebtoken');

const DEV_SECRET = 'dev-insecure-secret-change-me';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';

function getSecret() {
  return process.env.JWT_SECRET || DEV_SECRET;
}

function isUsingDevSecret() {
  return !process.env.JWT_SECRET;
}

function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, getSecret(), { expiresIn: EXPIRES_IN });
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    const payload = jwt.verify(token, getSecret());

    return payload && payload.sub ? String(payload.sub) : null;
  } catch (err) {
    return null;
  }
}

function extractBearer(header) {
  if (typeof header !== 'string') {
    return null;
  }

  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

module.exports = { signToken, verifyToken, extractBearer, isUsingDevSecret };
