const path = require('path');

const { parseIntegerOption } = require('./options');

const DEFAULT_PORT = parseIntegerOption(process.env.PORT, 8080, {
  min: 1,
  max: 65535,
});
const MAX_BODY_SIZE = '5mb';
const MAX_PUSH_BATCH = 200;
const MAX_PAYLOAD_BYTES = 1024 * 1024;
const MAX_VAULT_ITEMS = 10000;
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const PAIRING_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PAIRING_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
const DEFAULT_PAIRING_TTL_SECONDS = 10 * 60;
const MIN_PAIRING_TTL_SECONDS = 60;
const MAX_PAIRING_TTL_SECONDS = 30 * 60;
const MAX_WRAPPED_BUNDLE_BYTES = 64 * 1024;
const MAX_PAIRING_SESSIONS = 500;
const DEFAULT_RATE_LIMIT_WINDOW_MS = parseIntegerOption(
  process.env.RATE_LIMIT_WINDOW_MS,
  60 * 1000,
  { min: 1000, max: 60 * 60 * 1000 },
);
const DEFAULT_MAX_REQUESTS_PER_WINDOW = parseIntegerOption(
  process.env.RATE_LIMIT_MAX,
  600,
  { min: 0, max: 100000 },
);
const DEFAULT_DATA_DIR =
  typeof process.env.DATA_DIR === 'string' &&
  process.env.DATA_DIR.trim().length > 0
    ? process.env.DATA_DIR.trim()
    : path.join(__dirname, '..', 'data');
const DEFAULT_MAX_VAULT_FILE_BYTES = parseIntegerOption(
  process.env.MAX_VAULT_FILE_BYTES,
  128 * 1024 * 1024,
  { min: 1024 * 1024, max: 2 * 1024 * 1024 * 1024 },
);
const DEFAULT_STALE_TEMP_FILE_MAX_AGE_MS = parseIntegerOption(
  process.env.STALE_TEMP_FILE_MAX_AGE_MS,
  60 * 60 * 1000,
  { min: 0, max: 7 * 24 * 60 * 60 * 1000 },
);
const DEFAULT_REQUEST_TIMEOUT_MS = parseIntegerOption(
  process.env.REQUEST_TIMEOUT_MS,
  30 * 1000,
  { min: 1000, max: 5 * 60 * 1000 },
);
const DEFAULT_HEADERS_TIMEOUT_MS = parseIntegerOption(
  process.env.HEADERS_TIMEOUT_MS,
  10 * 1000,
  { min: 1000, max: 60 * 1000 },
);
const DEFAULT_KEEP_ALIVE_TIMEOUT_MS = parseIntegerOption(
  process.env.KEEP_ALIVE_TIMEOUT_MS,
  5 * 1000,
  { min: 1000, max: 60 * 1000 },
);
const DEFAULT_SHUTDOWN_TIMEOUT_MS = parseIntegerOption(
  process.env.SHUTDOWN_TIMEOUT_MS,
  5 * 1000,
  { min: 1000, max: 60 * 1000 },
);

module.exports = {
  DEFAULT_DATA_DIR,
  DEFAULT_HEADERS_TIMEOUT_MS,
  DEFAULT_KEEP_ALIVE_TIMEOUT_MS,
  DEFAULT_MAX_REQUESTS_PER_WINDOW,
  DEFAULT_MAX_VAULT_FILE_BYTES,
  DEFAULT_PAIRING_TTL_SECONDS,
  DEFAULT_PORT,
  DEFAULT_RATE_LIMIT_WINDOW_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  DEFAULT_STALE_TEMP_FILE_MAX_AGE_MS,
  MAX_BODY_SIZE,
  MAX_PAIRING_SESSIONS,
  MAX_PAIRING_TTL_SECONDS,
  MAX_PAYLOAD_BYTES,
  MAX_PUSH_BATCH,
  MAX_VAULT_ITEMS,
  MAX_WRAPPED_BUNDLE_BYTES,
  MIN_PAIRING_TTL_SECONDS,
  PAIRING_CODE_ALPHABET,
  PAIRING_CODE_PATTERN,
  SAFE_ID_PATTERN,
};
