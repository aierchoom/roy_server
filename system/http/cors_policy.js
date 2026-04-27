const cors = require('cors');

function parseCorsOrigins(rawValue) {
  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    return null;
  }
  const origins = rawValue
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  if (origins.length === 0 || origins.includes('*')) {
    return null;
  }
  return new Set(origins);
}

function createCorsMiddleware(rawOrigin) {
  const allowedOrigins = parseCorsOrigins(rawOrigin);
  if (!allowedOrigins) {
    return cors();
  }
  return cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  });
}

module.exports = {
  createCorsMiddleware,
  parseCorsOrigins,
};
