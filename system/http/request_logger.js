const { logMessage } = require('../logger');

function createRequestLoggerMiddleware({ logger, now }) {
  return (req, res, next) => {
    logMessage(
      logger,
      'info',
      `[${now().toISOString()}] [${req.requestId}] ${req.method} ${req.url}`,
    );
    next();
  };
}

module.exports = {
  createRequestLoggerMiddleware,
};
