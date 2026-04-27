const { createApp } = require('./system/app');
const { configureServerTimeouts, startServer } = require('./system/server');
const { createRateLimitMiddleware } = require('./system/http');
const { normalizePairingCode } = require('./system/pairing');
const { parseIntegerOption } = require('./system/options');
const {
  buildConflictResponse,
  buildNextVaultState,
  parseSinceVersion,
  validatePushes,
} = require('./system/sync');
const {
  cleanupStaleVaultTempFiles,
  createEmptyVault,
  getVaultPath,
  loadVault,
  saveVault,
} = require('./system/vault');

if (require.main === module) {
  startServer();
}

module.exports = {
  buildConflictResponse,
  buildNextVaultState,
  cleanupStaleVaultTempFiles,
  configureServerTimeouts,
  createApp,
  createEmptyVault,
  createRateLimitMiddleware,
  getVaultPath,
  loadVault,
  normalizePairingCode,
  parseIntegerOption,
  parseSinceVersion,
  saveVault,
  startServer,
  validatePushes,
};
