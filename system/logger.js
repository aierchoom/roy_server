function logMessage(logger, level, message) {
  if (typeof logger?.[level] === 'function') {
    logger[level](message);
    return;
  }
  if (typeof logger?.log === 'function') {
    logger.log(message);
  }
}

module.exports = {
  logMessage,
};
