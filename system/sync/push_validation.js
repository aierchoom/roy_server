const { MAX_PAYLOAD_BYTES, MAX_PUSH_BATCH } = require('../config');
const { RequestValidationError } = require('../errors');
const { validateSafeId } = require('../validation');

function validatePushes(pushes) {
  if (!Array.isArray(pushes)) {
    throw new RequestValidationError('Invalid pushes array');
  }
  if (pushes.length > MAX_PUSH_BATCH) {
    throw new RequestValidationError(
      `Push batch too large. Limit: ${MAX_PUSH_BATCH}`,
    );
  }

  const seenIds = new Set();
  return pushes.map((push) => normalizePush(push, seenIds));
}

function normalizePush(push, seenIds) {
  if (!push || typeof push !== 'object' || Array.isArray(push)) {
    throw new RequestValidationError('Each push must be an object');
  }

  validateSafeId(push.id, 'item id');
  if (seenIds.has(push.id)) {
    throw new RequestValidationError(`Duplicate item id in request: ${push.id}`);
  }
  seenIds.add(push.id);

  if (
    !Number.isInteger(push.expected_base_version) ||
    push.expected_base_version < 0
  ) {
    throw new RequestValidationError(
      `Invalid expected_base_version for item ${push.id}`,
    );
  }

  if (
    typeof push.encrypted_signed_payload !== 'string' ||
    push.encrypted_signed_payload.length === 0
  ) {
    throw new RequestValidationError(`Missing encrypted payload for item ${push.id}`);
  }

  if (
    Buffer.byteLength(push.encrypted_signed_payload, 'utf8') >
    MAX_PAYLOAD_BYTES
  ) {
    throw new RequestValidationError(
      `Encrypted payload too large for item ${push.id}`,
    );
  }

  return {
    id: push.id,
    expected_base_version: push.expected_base_version,
    is_deleted: push.is_deleted === true,
    encrypted_signed_payload: push.encrypted_signed_payload,
  };
}

module.exports = {
  validatePushes,
};
