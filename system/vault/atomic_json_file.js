const fs = require('fs');
const path = require('path');

const { DEFAULT_MAX_VAULT_FILE_BYTES } = require('../config');
const { RequestValidationError } = require('../errors');
const { ensureDataDir } = require('./directory');

function writeJsonAtomically(filePath, data, options = {}) {
  const tempPath = `${filePath}.${process.pid}.tmp`;
  const backupPath = `${filePath}.bak`;
  const payload = JSON.stringify(data, null, 2);
  const payloadBytes = Buffer.byteLength(payload, 'utf8');
  const hadOriginalFile = fs.existsSync(filePath);
  const maxVaultFileBytes =
    options.maxVaultFileBytes ?? DEFAULT_MAX_VAULT_FILE_BYTES;

  if (payloadBytes > maxVaultFileBytes) {
    throw new RequestValidationError(
      `Vault file too large. Limit: ${maxVaultFileBytes} bytes.`,
      413,
    );
  }

  const dataDir = ensureDataDir(path.dirname(filePath));

  try {
    writeFileSyncDurably(tempPath, payload);
    fsyncDirectoryBestEffort(dataDir);

    if (hadOriginalFile) {
      if (fs.existsSync(backupPath)) {
        fs.rmSync(backupPath, { force: true });
      }
      fs.renameSync(filePath, backupPath);
    }

    fs.renameSync(tempPath, filePath);
    fsyncDirectoryBestEffort(dataDir);

    if (fs.existsSync(backupPath)) {
      fs.rmSync(backupPath, { force: true });
    }
  } catch (error) {
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { force: true });
    }
    if (hadOriginalFile && fs.existsSync(backupPath) && !fs.existsSync(filePath)) {
      fs.renameSync(backupPath, filePath);
    }
    throw error;
  }
}

function writeFileSyncDurably(filePath, payload) {
  const descriptor = fs.openSync(filePath, 'w', 0o600);
  try {
    fs.writeFileSync(descriptor, payload, { encoding: 'utf8' });
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function fsyncDirectoryBestEffort(directoryPath) {
  try {
    const descriptor = fs.openSync(directoryPath, 'r');
    try {
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
  } catch (_) {
    // Directory fsync is not consistently supported on all target platforms.
  }
}

module.exports = {
  writeJsonAtomically,
};
