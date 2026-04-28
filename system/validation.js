const { SAFE_ID_PATTERN } = require('./config');
const { RequestValidationError } = require('./errors');

const REQUESTER_PUBLIC_KEY_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;

function validateSafeId(value, label) {
  if (typeof value !== 'string' || !SAFE_ID_PATTERN.test(value)) {
    throw new RequestValidationError(`Invalid ${label} format`);
  }
}

function validateRequesterPublicKey(value) {
  if (
    typeof value !== 'string' ||
    !REQUESTER_PUBLIC_KEY_PATTERN.test(value.trim())
  ) {
    throw new RequestValidationError('Invalid requester_public_key format');
  }
  return value.trim();
}

module.exports = {
  validateRequesterPublicKey,
  validateSafeId,
};
