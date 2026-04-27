const fs = require('fs');

const { DEFAULT_MAX_VAULT_FILE_BYTES } = require('../config');

function assertVaultFileWithinLimit(
  filePath,
  maxVaultFileBytes = DEFAULT_MAX_VAULT_FILE_BYTES,
) {
  const stats = fs.statSync(filePath);
  if (!stats.isFile()) {
    throw new Error('Vault path is not a regular file');
  }
  if (stats.size > maxVaultFileBytes) {
    throw new Error(
      `Vault file exceeds configured size limit: ${stats.size} bytes`,
    );
  }
}

module.exports = {
  assertVaultFileWithinLimit,
};
