const { buildConflictResponse } = require('./conflicts');

function buildNextVaultState(vault, pushes) {
  const nextVault = {
    currentVersion: vault.currentVersion,
    items: { ...vault.items },
  };
  const acceptedVersions = {};

  for (const push of pushes) {
    const existing = nextVault.items[push.id];
    const existingVersion = existing ? existing.version : 0;
    if (existingVersion !== push.expected_base_version) {
      return {
        ok: false,
        conflict: buildConflictResponse(push, existing),
      };
    }
  }

  for (const push of pushes) {
    nextVault.currentVersion += 1;
    nextVault.items[push.id] = {
      id: push.id,
      version: nextVault.currentVersion,
      encrypted_signed_payload: push.encrypted_signed_payload,
      is_deleted: push.is_deleted,
    };
    acceptedVersions[push.id] = nextVault.currentVersion;
  }

  return {
    ok: true,
    vault: nextVault,
    acceptedVersions,
  };
}

module.exports = {
  buildNextVaultState,
};
