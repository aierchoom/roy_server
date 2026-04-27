const { RequestValidationError } = require('../errors');
const { sendRouteError } = require('./error_response');

function createJsonContentTypeMiddleware() {
  return (req, res, next) => {
    if (
      ['POST', 'PUT', 'PATCH'].includes(req.method) &&
      req.headers['content-length'] !== '0' &&
      !req.is('application/json')
    ) {
      return sendRouteError(
        res,
        new RequestValidationError('Content-Type must be application/json', 415),
      );
    }
    return next();
  };
}

module.exports = {
  createJsonContentTypeMiddleware,
};
