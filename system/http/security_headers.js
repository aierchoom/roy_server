const { resolveRequestId } = require('./request_id');

function createSecurityHeadersMiddleware() {
  return (req, res, next) => {
    req.requestId = resolveRequestId(req.get('x-request-id'));
    res.setHeader('X-Request-Id', req.requestId);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  };
}

module.exports = {
  createSecurityHeadersMiddleware,
};
