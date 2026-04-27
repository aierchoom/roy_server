const fs = require('fs');
const path = require('path');

const { DEFAULT_DATA_DIR } = require('../config');
const { VaultPersistenceError } = require('../errors');
const { randomHex } = require('../ids');

function resolveDataDir(dataDir = DEFAULT_DATA_DIR) {
  const rawDataDir =
    typeof dataDir === 'string' && dataDir.trim().length > 0
      ? dataDir.trim()
      : DEFAULT_DATA_DIR;
  return path.resolve(rawDataDir);
}

function ensureDataDir(dataDir, { verifyWritable = false } = {}) {
  const resolvedDataDir = resolveDataDir(dataDir);
  try {
    if (fs.existsSync(resolvedDataDir)) {
      if (!fs.statSync(resolvedDataDir).isDirectory()) {
        throw new VaultPersistenceError(
          `Data path is not a directory: ${resolvedDataDir}`,
        );
      }
    } else {
      fs.mkdirSync(resolvedDataDir, { recursive: true, mode: 0o700 });
    }

    if (verifyWritable) {
      verifyDataDirWritable(resolvedDataDir);
    }

    return resolvedDataDir;
  } catch (error) {
    if (error instanceof VaultPersistenceError) {
      throw error;
    }
    throw new VaultPersistenceError(
      `Data directory is unavailable: ${resolvedDataDir}`,
    );
  }
}

function verifyDataDirWritable(dataDir) {
  const probePath = path.join(
    dataDir,
    `.write-test-${process.pid}-${Date.now()}-${randomHex(6)}`,
  );
  try {
    fs.writeFileSync(probePath, '', {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
  } finally {
    try {
      fs.rmSync(probePath, { force: true });
    } catch (_) {
      // The follow-up write will fail too if a stale probe cannot be removed.
    }
  }
}

module.exports = {
  ensureDataDir,
  resolveDataDir,
};
