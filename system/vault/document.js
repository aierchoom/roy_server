const { MAX_PAYLOAD_BYTES, MAX_VAULT_ITEMS } = require('../config');
const { validateSafeId } = require('../validation');

function createEmptyVault() {
  return { currentVersion: 0, items: {} };
}

function normalizeVault(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid vault document');
  }

  const currentVersion =
    Number.isInteger(data.currentVersion) && data.currentVersion >= 0
      ? data.currentVersion
      : 0;
  const rawItems =
    data.items && typeof data.items === 'object' && !Array.isArray(data.items)
      ? data.items
      : {};
  const entries = Object.entries(rawItems);
  if (entries.length > MAX_VAULT_ITEMS) {
    throw new Error(`Vault item limit exceeded: ${MAX_VAULT_ITEMS}`);
  }

  const items = {};
  for (const [itemId, item] of entries) {
    items[itemId] = normalizeVaultItem(itemId, item);
  }

  return { currentVersion, items };
}

function normalizeVaultItem(itemId, item) {
  validateSafeId(itemId, 'stored item id');
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error(`Invalid stored item: ${itemId}`);
  }
  const id = typeof item.id === 'string' && item.id.length > 0 ? item.id : itemId;
  validateSafeId(id, 'stored item id');
  if (id !== itemId) {
    throw new Error(`Stored item id mismatch: ${itemId}`);
  }
  if (!Number.isInteger(item.version) || item.version < 0) {
    throw new Error(`Invalid stored item version: ${itemId}`);
  }
  if (
    typeof item.encrypted_signed_payload !== 'string' ||
    Buffer.byteLength(item.encrypted_signed_payload, 'utf8') > MAX_PAYLOAD_BYTES
  ) {
    throw new Error(`Invalid stored item payload: ${itemId}`);
  }
  return {
    id,
    version: item.version,
    encrypted_signed_payload: item.encrypted_signed_payload,
    is_deleted: item.is_deleted === true,
  };
}

module.exports = {
  createEmptyVault,
  normalizeVault,
};
