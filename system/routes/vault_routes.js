const { sendRouteError } = require('../http');
const { logMessage } = require('../logger');
const {
  buildNextVaultState,
  parseSinceVersion,
  validatePushes,
} = require('../sync');
const { loadVault, saveVault } = require('../vault');

function registerVaultRoutes(app, { dataDir, logger, maxVaultFileBytes }) {
  app.get('/vaults/:vaultId/sync', (req, res) => {
    try {
      const vaultId = req.params.vaultId;
      const since = parseSinceVersion(req.query.since);
      const vault = loadVault(dataDir, vaultId, {
        maxVaultFileBytes,
      });

      if (vault.currentVersion <= since) {
        return res.status(304).end();
      }

      const changes = Object.values(vault.items).filter(
        (item) => item.version > since,
      );
      return res.json({
        max_version: vault.currentVersion,
        items: changes,
      });
    } catch (error) {
      return sendRouteError(res, error);
    }
  });

  app.post('/vaults/:vaultId/sync', (req, res) => {
    try {
      const vaultId = req.params.vaultId;
      const pushes = validatePushes(req.body.pushes);
      const vault = loadVault(dataDir, vaultId, {
        maxVaultFileBytes,
      });
      const plannedWrite = buildNextVaultState(vault, pushes);

      if (!plannedWrite.ok) {
        logMessage(
          logger,
          'warn',
          `[409 Conflict:${plannedWrite.conflict.conflict_type}] item ${plannedWrite.conflict.item_id}. Expected ${plannedWrite.conflict.your_base}, got ${plannedWrite.conflict.server_actual}`,
        );
        return res.status(409).json(plannedWrite.conflict);
      }

      saveVault(dataDir, vaultId, plannedWrite.vault, {
        maxVaultFileBytes,
      });

      logMessage(
        logger,
        'info',
        `[Success] Vault ${vaultId} pushed ${pushes.length} items. New Max Version: ${plannedWrite.vault.currentVersion}`,
      );

      return res.json({
        success: true,
        max_version: plannedWrite.vault.currentVersion,
        accepted_versions: plannedWrite.acceptedVersions,
      });
    } catch (error) {
      return sendRouteError(res, error);
    }
  });
}

module.exports = {
  registerVaultRoutes,
};
