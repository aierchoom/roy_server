const {
  DEFAULT_DATA_DIR,
  DEFAULT_HEADERS_TIMEOUT_MS,
  DEFAULT_KEEP_ALIVE_TIMEOUT_MS,
  DEFAULT_PORT,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
} = require('./config');
const { createApp } = require('./app');
const { logMessage } = require('./logger');
const { parseIntegerOption } = require('./options');
const { resolveDataDir } = require('./vault');

function configureServerTimeouts(
  server,
  {
    requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    headersTimeoutMs = DEFAULT_HEADERS_TIMEOUT_MS,
    keepAliveTimeoutMs = DEFAULT_KEEP_ALIVE_TIMEOUT_MS,
  } = {},
) {
  const requestTimeout = parseIntegerOption(
    requestTimeoutMs,
    DEFAULT_REQUEST_TIMEOUT_MS,
    { min: 1000, max: 5 * 60 * 1000 },
  );
  const headersTimeout = Math.min(
    parseIntegerOption(headersTimeoutMs, DEFAULT_HEADERS_TIMEOUT_MS, {
      min: 1000,
      max: 60 * 1000,
    }),
    requestTimeout,
  );
  const keepAliveTimeout = parseIntegerOption(
    keepAliveTimeoutMs,
    DEFAULT_KEEP_ALIVE_TIMEOUT_MS,
    { min: 1000, max: 60 * 1000 },
  );

  server.requestTimeout = requestTimeout;
  server.headersTimeout = headersTimeout;
  server.keepAliveTimeout = keepAliveTimeout;
  server.maxHeadersCount = 100;

  return {
    requestTimeoutMs: requestTimeout,
    headersTimeoutMs: headersTimeout,
    keepAliveTimeoutMs: keepAliveTimeout,
  };
}

function startServer({
  port = DEFAULT_PORT,
  dataDir = DEFAULT_DATA_DIR,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  headersTimeoutMs = DEFAULT_HEADERS_TIMEOUT_MS,
  keepAliveTimeoutMs = DEFAULT_KEEP_ALIVE_TIMEOUT_MS,
  shutdownTimeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
} = {}) {
  const resolvedDataDir = resolveDataDir(dataDir);
  const app = createApp({ dataDir: resolvedDataDir });
  const server = app.listen(port, () => {
    console.log('--------------------------------------------------');
    console.log('    SecretRoy Distributed Vault Server            ');
    console.log(`    Running on http://localhost:${port}           `);
    console.log('    E2EE Enabled | JSON Document Store Mode       ');
    console.log(`    Data Dir: ${resolvedDataDir}`);
    console.log('--------------------------------------------------');
  });
  const timeoutConfig = configureServerTimeouts(server, {
    requestTimeoutMs,
    headersTimeoutMs,
    keepAliveTimeoutMs,
  });

  let isShuttingDown = false;
  const shutdown = (signal) => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;
    console.log(`[${signal}] Closing SecretRoy sync server...`);
    const forceExitTimer = setTimeout(() => {
      console.error('Forced shutdown after timeout.');
      process.exit(1);
    }, shutdownTimeoutMs).unref();

    server.close(() => {
      clearTimeout(forceExitTimer);
      console.log('SecretRoy sync server closed.');
      process.exit(0);
    });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  logMessage(
    console,
    'info',
    `[Startup] HTTP timeouts: request=${timeoutConfig.requestTimeoutMs}ms, headers=${timeoutConfig.headersTimeoutMs}ms, keepAlive=${timeoutConfig.keepAliveTimeoutMs}ms`,
  );

  return server;
}

module.exports = {
  configureServerTimeouts,
  startServer,
};
