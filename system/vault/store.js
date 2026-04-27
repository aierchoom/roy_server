const fs = require('fs');
const path = require('path');

const { RequestValidationError, VaultPersistenceError } = require('../errors');
const { writeJsonAtomically } = require('./atomic_json_file');
const { createEmptyVault, normalizeVault } = require('./document');
const { assertVaultFileWithinLimit } = require('./file_limits');
const { getVaultBackupPath, getVaultPath } = require('./paths');

function readVaultDocument(filePath, options = {}) {
  assertVaultFileWithinLimit(filePath, options.maxVaultFileBytes);
  return normalizeVault(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

function loadVault(dataDir, vaultId, options = {}) {
  const vaultPath = getVaultPath(dataDir, vaultId);
  const backupPath = getVaultBackupPath(vaultPath);
  const hasPrimary = fs.existsSync(vaultPath);
  const hasBackup = fs.existsSync(backupPath);

  if (!hasPrimary && !hasBackup) {
    return createEmptyVault();
  }

  try {
    if (hasPrimary) {
      return readVaultDocument(vaultPath, options);
    }
    return readVaultDocument(backupPath, options);
  } catch (error) {
    if (hasPrimary && hasBackup) {
      try {
        return readVaultDocument(backupPath, options);
      } catch (_) {
        // Fall through to the shared unreadable-vault error below.
      }
    }
    throw new VaultPersistenceError(
      `Vault file is unreadable: ${path.basename(vaultPath)}`,
    );
  }
}

function saveVault(dataDir, vaultId, data, options = {}) {
  const normalized = normalizeVault(data);
  try {
    writeJsonAtomically(getVaultPath(dataDir, vaultId), normalized, options);
  } catch (error) {
    if (error instanceof RequestValidationError) {
      throw error;
    }
    throw new VaultPersistenceError(`Failed to persist vault ${vaultId}`);
  }
}

module.exports = {
  loadVault,
  readVaultDocument,
  saveVault,
};
