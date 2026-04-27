const {
  PairingSessionError,
  RequestValidationError,
  VaultPersistenceError,
} = require('../errors');
const { logMessage } = require('../logger');

function sendRouteError(res, error) {
  if (error instanceof RequestValidationError) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  if (error instanceof VaultPersistenceError) {
    return res.status(503).json({ error: error.message });
  }
  if (error instanceof PairingSessionError) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  return res.status(500).json({ error: 'Internal server error' });
}

function createErrorHandler(logger) {
  return (error, req, res, next) => {
    if (error instanceof RequestValidationError) {
      return sendRouteError(res, error);
    }
    if (error?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'JSON body too large' });
    }
    if (error instanceof SyntaxError && 'body' in error) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    logMessage(logger, 'error', `[Internal Error] ${error?.stack || error}`);
    return res.status(500).json({ error: 'Internal server error' });
  };
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Route not found' });
}

module.exports = {
  createErrorHandler,
  notFoundHandler,
  sendRouteError,
};
