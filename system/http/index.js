const { MAX_BODY_SIZE } = require('../config');
const { createCorsMiddleware, parseCorsOrigins } = require('./cors_policy');
const {
  createErrorHandler,
  notFoundHandler,
  sendRouteError,
} = require('./error_response');
const { createJsonContentTypeMiddleware } = require('./json_body');
const { createRateLimitMiddleware } = require('./rate_limit');
const { createRequestLoggerMiddleware } = require('./request_logger');
const { resolveRequestId } = require('./request_id');
const { createSecurityHeadersMiddleware } = require('./security_headers');

module.exports = {
  MAX_BODY_SIZE,
  createCorsMiddleware,
  createErrorHandler,
  createJsonContentTypeMiddleware,
  createRateLimitMiddleware,
  createRequestLoggerMiddleware,
  createSecurityHeadersMiddleware,
  notFoundHandler,
  parseCorsOrigins,
  resolveRequestId,
  sendRouteError,
};
