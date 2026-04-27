const fs = require('fs');
const path = require('path');

const { DEFAULT_STALE_TEMP_FILE_MAX_AGE_MS } = require('../config');
const { logMessage } = require('../logger');
const { resolveDataDir } = require('./directory');

function cleanupStaleVaultTempFiles(
  dataDir,
  {
    nowMs = Date.now(),
    maxAgeMs = DEFAULT_STALE_TEMP_FILE_MAX_AGE_MS,
    logger,
  } = {},
) {
  const resolvedDataDir = resolveDataDir(dataDir);
  if (!fs.existsSync(resolvedDataDir)) {
    return 0;
  }

  let removedCount = 0;
  for (const entry of fs.readdirSync(resolvedDataDir, { withFileTypes: true })) {
    if (
      !entry.isFile() ||
      !/^vault_[A-Za-z0-9_-]+\.json\.\d+\.tmp$/.test(entry.name)
    ) {
      continue;
    }

    const tempPath = path.join(resolvedDataDir, entry.name);
    try {
      const stats = fs.statSync(tempPath);
      const ageMs = Math.max(0, nowMs - stats.mtimeMs);
      if (maxAgeMs <= 0 || ageMs >= maxAgeMs) {
        fs.rmSync(tempPath, { force: true });
        removedCount += 1;
      }
    } catch (error) {
      logMessage(
        logger,
        'warn',
        `Failed to clean stale temp file ${entry.name}: ${error.message}`,
      );
    }
  }

  return removedCount;
}

module.exports = {
  cleanupStaleVaultTempFiles,
};
