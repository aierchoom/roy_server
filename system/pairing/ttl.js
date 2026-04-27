const {
  DEFAULT_PAIRING_TTL_SECONDS,
  MAX_PAIRING_TTL_SECONDS,
  MIN_PAIRING_TTL_SECONDS,
} = require('../config');
const { RequestValidationError } = require('../errors');

function parsePairingTtlSeconds(rawValue) {
  if (rawValue == null) {
    return DEFAULT_PAIRING_TTL_SECONDS;
  }
  const parsed = Number.parseInt(String(rawValue), 10);
  if (!Number.isInteger(parsed)) {
    throw new RequestValidationError('Invalid pairing_ttl_seconds');
  }
  return Math.min(MAX_PAIRING_TTL_SECONDS, Math.max(MIN_PAIRING_TTL_SECONDS, parsed));
}

module.exports = {
  parsePairingTtlSeconds,
};
