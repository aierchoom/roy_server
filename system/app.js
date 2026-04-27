const express = require('express');

const {
  DEFAULT_DATA_DIR,
  DEFAULT_MAX_REQUESTS_PER_WINDOW,
  DEFAULT_MAX_VAULT_FILE_BYTES,
  DEFAULT_RATE_LIMIT_WINDOW_MS,
} = require('./config');
const {
  MAX_BODY_SIZE,
  createCorsMiddleware,
  createErrorHandler,
  createJsonContentTypeMiddleware,
  createRateLimitMiddleware,
  createRequestLoggerMiddleware,
  createSecurityHeadersMiddleware,
  notFoundHandler,
} = require('./http');
const { logMessage } = require('./logger');
const { createPairingStore } = require('./pairing');
const { registerPairingRoutes } = require('./routes/pairing');
const { registerSystemRoutes } = require('./routes/system_routes');
const { registerVaultRoutes } = require('./routes/vault_routes');
const {
  cleanupStaleVaultTempFiles,
  ensureDataDir,
} = require('./vault');

function createApp({
  dataDir = DEFAULT_DATA_DIR,
  logger = console,
  now = () => new Date(),
  rateLimitWindowMs = DEFAULT_RATE_LIMIT_WINDOW_MS,
  maxRequestsPerWindow = DEFAULT_MAX_REQUESTS_PER_WINDOW,
  maxVaultFileBytes = DEFAULT_MAX_VAULT_FILE_BYTES,
  corsOrigin = process.env.CORS_ORIGIN,
} = {}) {
  const resolvedDataDir = ensureDataDir(dataDir, { verifyWritable: true });
  const cleanedTempFiles = cleanupStaleVaultTempFiles(resolvedDataDir, {
    nowMs: now().getTime(),
    logger,
  });
  if (cleanedTempFiles > 0) {
    logMessage(
      logger,
      'info',
      `[Startup] Cleaned ${cleanedTempFiles} stale vault temp file(s).`,
    );
  }

  const pairingStore = createPairingStore();
  const app = express();
  app.disable('x-powered-by');

  app.use(createSecurityHeadersMiddleware());
  app.use(createCorsMiddleware(corsOrigin));
  app.use(
    createRateLimitMiddleware({
      now,
      windowMs: rateLimitWindowMs,
      maxRequests: maxRequestsPerWindow,
    }),
  );
  app.use(createJsonContentTypeMiddleware());
  app.use(express.json({ limit: MAX_BODY_SIZE }));
  app.use(createRequestLoggerMiddleware({ logger, now }));

  registerSystemRoutes(app);
  registerPairingRoutes(app, { pairingStore, now });
  registerVaultRoutes(app, {
    dataDir: resolvedDataDir,
    logger,
    maxVaultFileBytes,
  });

  app.use(createErrorHandler(logger));
  app.use(notFoundHandler);

  return app;
}

module.exports = {
  createApp,
};
