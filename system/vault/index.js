const { writeJsonAtomically } = require('./atomic_json_file');
const { cleanupStaleVaultTempFiles } = require('./cleanup');
const { ensureDataDir, resolveDataDir } = require('./directory');
const { createEmptyVault, normalizeVault } = require('./document');
const { assertVaultFileWithinLimit } = require('./file_limits');
const { getVaultBackupPath, getVaultPath } = require('./paths');
const { loadVault, readVaultDocument, saveVault } = require('./store');

module.exports = {
  assertVaultFileWithinLimit,
  cleanupStaleVaultTempFiles,
  createEmptyVault,
  ensureDataDir,
  getVaultBackupPath,
  getVaultPath,
  loadVault,
  normalizeVault,
  readVaultDocument,
  resolveDataDir,
  saveVault,
  writeJsonAtomically,
};
