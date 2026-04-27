const path = require('path');

const { validateSafeId } = require('../validation');

function getVaultPath(dataDir, vaultId) {
  validateSafeId(vaultId, 'vault id');
  return path.join(dataDir, `vault_${vaultId}.json`);
}

function getVaultBackupPath(vaultPath) {
  return `${vaultPath}.bak`;
}

module.exports = {
  getVaultBackupPath,
  getVaultPath,
};
