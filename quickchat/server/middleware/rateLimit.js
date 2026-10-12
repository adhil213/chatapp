function createRateLimiter({ windowMs, max, key, message }) {
  const hits = new Map();

  return function rateLimiter(req, res, next) {
    const id = `${key ? key(req) : req.ip || 'anon'}:${req.baseUrl || ''}${req.path || ''}`;
    const now = Date.now();

    let record = hits.get(id);

    if (!record || now > record.reset) {
      record = { count: 0, reset: now + windowMs };
      hits.set(id, record);
    }

    record.count += 1;

    if (record.count > max) {
      const retryAfter = Math.ceil((record.reset - now) / 1000);

      res.setHeader('Retry-After', String(Math.max(retryAfter, 1)));

      return res.status(429).json({
        message: message || 'Too many requests, please slow down',
        code: 'RATE_LIMITED',
      });
    }

    return next();
  };
}

module.exports = { createRateLimiter };
