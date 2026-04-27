const {
  DEFAULT_MAX_REQUESTS_PER_WINDOW,
  DEFAULT_RATE_LIMIT_WINDOW_MS,
} = require('../config');

function createRateLimitMiddleware({
  now,
  windowMs = DEFAULT_RATE_LIMIT_WINDOW_MS,
  maxRequests = DEFAULT_MAX_REQUESTS_PER_WINDOW,
} = {}) {
  const clients = new Map();

  return (req, res, next) => {
    if (!Number.isFinite(maxRequests) || maxRequests <= 0) {
      return next();
    }

    const currentMs = now().getTime();
    if (clients.size > 1000) {
      for (const [key, entry] of clients.entries()) {
        if (entry.resetAtMs <= currentMs) {
          clients.delete(key);
        }
      }
    }

    const clientKey = req.ip || req.socket?.remoteAddress || 'unknown';
    let entry = clients.get(clientKey);
    if (!entry || entry.resetAtMs <= currentMs) {
      entry = {
        count: 0,
        resetAtMs: currentMs + windowMs,
      };
      clients.set(clientKey, entry);
    }

    entry.count += 1;
    const remaining = Math.max(0, maxRequests - entry.count);
    res.setHeader('RateLimit-Limit', String(maxRequests));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader(
      'RateLimit-Reset',
      String(Math.ceil(entry.resetAtMs / 1000)),
    );

    if (entry.count > maxRequests) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    return next();
  };
}

module.exports = {
  createRateLimitMiddleware,
};
