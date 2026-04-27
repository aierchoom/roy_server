const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

class RequestValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

class VaultPersistenceError extends Error {}

class PairingSessionError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function createEmptyVault() {
  return { currentVersion: 0, items: {} };
}

function parseIntegerOption(rawValue, fallback, { min, max } = {}) {
  if (rawValue == null || rawValue === '') {
    return fallback;
  }
  const parsed = Number.parseInt(String(rawValue), 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  if (Number.isInteger(min) && parsed < min) {
    return fallback;
  }
  if (Number.isInteger(max) && parsed > max) {
    return fallback;
  }
  return parsed;
}

function ensureDataDir(dataDir) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function validateSafeId(value, label) {
  if (typeof value !== 'string' || !SAFE_ID_PATTERN.test(value)) {
    throw new RequestValidationError(`Invalid ${label} format`);
  }
}

function getVaultPath(dataDir, vaultId) {
  validateSafeId(vaultId, 'vault id');
  return path.join(dataDir, `vault_${vaultId}.json`);
}

function getVaultBackupPath(vaultPath) {
  return `${vaultPath}.bak`;
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

function readVaultDocument(filePath) {
  return normalizeVault(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

function loadVault(dataDir, vaultId) {
  const vaultPath = getVaultPath(dataDir, vaultId);
  const backupPath = getVaultBackupPath(vaultPath);
  const hasPrimary = fs.existsSync(vaultPath);
  const hasBackup = fs.existsSync(backupPath);

  if (!hasPrimary && !hasBackup) {
    return createEmptyVault();
  }

  try {
    if (hasPrimary) {
      return readVaultDocument(vaultPath);
    }
    return readVaultDocument(backupPath);
  } catch (error) {
    if (hasPrimary && hasBackup) {
      try {
        return readVaultDocument(backupPath);
      } catch (_) {
        // Fall through to the shared unreadable-vault error below.
      }
    }
    throw new VaultPersistenceError(
      `Vault file is unreadable: ${path.basename(vaultPath)}`,
    );
  }
}

function writeJsonAtomically(filePath, data) {
  const tempPath = `${filePath}.${process.pid}.tmp`;
  const backupPath = `${filePath}.bak`;
  const payload = JSON.stringify(data, null, 2);
  const hadOriginalFile = fs.existsSync(filePath);

  ensureDataDir(path.dirname(filePath));
  fs.writeFileSync(tempPath, payload, { encoding: 'utf8' });

  try {
    if (hadOriginalFile) {
      if (fs.existsSync(backupPath)) {
        fs.rmSync(backupPath, { force: true });
      }
      fs.renameSync(filePath, backupPath);
    }

    fs.renameSync(tempPath, filePath);

    if (fs.existsSync(backupPath)) {
      fs.rmSync(backupPath, { force: true });
    }
  } catch (error) {
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { force: true });
    }
    if (hadOriginalFile && fs.existsSync(backupPath) && !fs.existsSync(filePath)) {
      fs.renameSync(backupPath, filePath);
    }
    throw error;
  }
}

function saveVault(dataDir, vaultId, data) {
  const normalized = normalizeVault(data);
  try {
    writeJsonAtomically(getVaultPath(dataDir, vaultId), normalized);
  } catch (error) {
    throw new VaultPersistenceError(`Failed to persist vault ${vaultId}`);
  }
}

function parseSinceVersion(rawValue) {
  const parsed = Number.parseInt(String(rawValue ?? '0'), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new RequestValidationError('Invalid since version');
  }
  return parsed;
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

function buildConflictResponse(push, existing) {
  const existingVersion = existing ? existing.version : 0;
  let conflictType = 'stale_base_version';

  if (!existing) {
    conflictType = 'remote_missing';
  } else if (existing.is_deleted === true) {
    conflictType = 'concurrent_delete';
  } else if (push.expected_base_version === 0 && existingVersion > 0) {
    conflictType = 'concurrent_edit';
  }

  return {
    error: `Conflict detected on item ${push.id}`,
    conflict_type: conflictType,
    item_id: push.id,
    your_base: push.expected_base_version,
    server_actual: existingVersion,
    server_is_deleted: existing?.is_deleted === true,
  };
}

function logMessage(logger, level, message) {
  if (typeof logger?.[level] === 'function') {
    logger[level](message);
    return;
  }
  if (typeof logger?.log === 'function') {
    logger.log(message);
  }
}

function resolveRequestId(rawRequestId) {
  if (
    typeof rawRequestId === 'string' &&
    rawRequestId.length > 0 &&
    rawRequestId.length <= 80 &&
    /^[a-zA-Z0-9_.:-]+$/.test(rawRequestId)
  ) {
    return rawRequestId;
  }
  return `req_${randomHex(12)}`;
}

function createRateLimitMiddleware({
  now,
  windowMs = DEFAULT_RATE_LIMIT_WINDOW_MS,
  maxRequests = DEFAULT_MAX_REQUESTS_PER_WINDOW,
} = {}) {
  const clients = new Map();

  return (req, res, next) => {
    if (!Number.isFinite(maxRequests) || maxRequests <= 0) {
      return next();
    }

    const currentMs = now().getTime();
    if (clients.size > 1000) {
      for (const [key, entry] of clients.entries()) {
        if (entry.resetAtMs <= currentMs) {
          clients.delete(key);
        }
      }
    }

    const clientKey = req.ip || req.socket?.remoteAddress || 'unknown';
    let entry = clients.get(clientKey);
    if (!entry || entry.resetAtMs <= currentMs) {
      entry = {
        count: 0,
        resetAtMs: currentMs + windowMs,
      };
      clients.set(clientKey, entry);
    }

    entry.count += 1;
    const remaining = Math.max(0, maxRequests - entry.count);
    res.setHeader('RateLimit-Limit', String(maxRequests));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader(
      'RateLimit-Reset',
      String(Math.ceil(entry.resetAtMs / 1000)),
    );

    if (entry.count > maxRequests) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    return next();
  };
}

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

function createPairingStore() {
  return {
    sessionsById: new Map(),
    sessionsByCode: new Map(),
  };
}

function randomHex(length) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

function generatePairingCode() {
  let code = '';
  const unbiasedLimit =
    Math.floor(256 / PAIRING_CODE_ALPHABET.length) * PAIRING_CODE_ALPHABET.length;
  while (code.length < 8) {
    let randomValue = crypto.randomBytes(1)[0];
    while (randomValue >= unbiasedLimit) {
      randomValue = crypto.randomBytes(1)[0];
    }
    randomValue %= PAIRING_CODE_ALPHABET.length;
    code += PAIRING_CODE_ALPHABET[randomValue];
  }
  return code;
}

function normalizePairingCode(rawPairingCode) {
  if (typeof rawPairingCode !== 'string' || rawPairingCode.trim().length === 0) {
    throw new RequestValidationError('Pairing code is required.');
  }
  const pairingCode = rawPairingCode.replace(/\s+/g, '').toUpperCase();
  if (!PAIRING_CODE_PATTERN.test(pairingCode)) {
    throw new RequestValidationError('Invalid pairing code format.');
  }
  return pairingCode;
}

function sweepExpiredPairingSessions(store, nowMs = Date.now()) {
  for (const [sessionId, session] of store.sessionsById.entries()) {
    if (session.expiresAtMs <= nowMs) {
      store.sessionsById.delete(sessionId);
      store.sessionsByCode.delete(session.pairingCode);
    }
  }
}

function assertPairingCapacity(store) {
  if (store.sessionsById.size >= MAX_PAIRING_SESSIONS) {
    throw new PairingSessionError(
      503,
      'Pairing session capacity reached. Retry shortly.',
    );
  }
}

function getSessionOrThrow(store, sessionId, nowMs = Date.now()) {
  const session = store.sessionsById.get(sessionId);
  if (!session) {
    throw new PairingSessionError(404, 'Pairing session not found.');
  }
  if (session.expiresAtMs <= nowMs) {
    store.sessionsById.delete(session.id);
    store.sessionsByCode.delete(session.pairingCode);
    throw new PairingSessionError(410, 'Pairing session expired.');
  }
  return session;
}

function assertHostOwnership(session, hostDeviceId) {
  validateSafeId(hostDeviceId, 'host device id');
  if (session.hostDeviceId !== hostDeviceId) {
    throw new PairingSessionError(403, 'Host device is not authorized for this pairing session.');
  }
}

function assertRequesterOwnership(session, requesterDeviceId, requestId) {
  validateSafeId(requesterDeviceId, 'requester device id');
  if (!session.pendingRequest || session.pendingRequest.id !== requestId) {
    throw new PairingSessionError(404, 'Pairing request not found.');
  }
  if (session.pendingRequest.requesterDeviceId !== requesterDeviceId) {
    throw new PairingSessionError(403, 'Requester device is not authorized for this pairing request.');
  }
}

function toIsoTimestamp(timestampMs) {
  return new Date(timestampMs).toISOString();
}

function sendRouteError(res, error) {
  if (error instanceof RequestValidationError) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  if (error instanceof VaultPersistenceError) {
    return res.status(503).json({ error: error.message });
  }
  if (error instanceof PairingSessionError) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  return res.status(500).json({ error: 'Internal server error' });
}

function createApp({
  dataDir = path.join(__dirname, 'data'),
  logger = console,
  now = () => new Date(),
  rateLimitWindowMs = DEFAULT_RATE_LIMIT_WINDOW_MS,
  maxRequestsPerWindow = DEFAULT_MAX_REQUESTS_PER_WINDOW,
} = {}) {
  ensureDataDir(dataDir);
  const pairingStore = createPairingStore();

  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    req.requestId = resolveRequestId(req.get('x-request-id'));
    res.setHeader('X-Request-Id', req.requestId);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });
  app.use(cors());
  app.use(
    createRateLimitMiddleware({
      now,
      windowMs: rateLimitWindowMs,
      maxRequests: maxRequestsPerWindow,
    }),
  );
  app.use((req, res, next) => {
    if (
      ['POST', 'PUT', 'PATCH'].includes(req.method) &&
      req.headers['content-length'] !== '0' &&
      !req.is('application/json')
    ) {
      return sendRouteError(
        res,
        new RequestValidationError('Content-Type must be application/json', 415),
      );
    }
    return next();
  });
  app.use(express.json({ limit: MAX_BODY_SIZE }));

  app.use((req, res, next) => {
    logMessage(
      logger,
      'info',
      `[${now().toISOString()}] [${req.requestId}] ${req.method} ${req.url}`,
    );
    next();
  });

  app.get('/healthz', (req, res) => {
    res.json({ ok: true, status: 'healthy' });
  });

  app.post('/pairing/sessions', (req, res) => {
    try {
      sweepExpiredPairingSessions(pairingStore, now().getTime());
      assertPairingCapacity(pairingStore);

      const vaultId = req.body?.vault_id;
      const hostDeviceId = req.body?.host_device_id;
      const ttlSeconds = parsePairingTtlSeconds(req.body?.pairing_ttl_seconds);
      validateSafeId(vaultId, 'vault id');
      validateSafeId(hostDeviceId, 'host device id');

      const sessionId = `ps_${randomHex(16)}`;
      let pairingCode = '';
      for (let index = 0; index < 12; index += 1) {
        const candidate = generatePairingCode();
        if (!pairingStore.sessionsByCode.has(candidate)) {
          pairingCode = candidate;
          break;
        }
      }
      if (!pairingCode) {
        throw new PairingSessionError(
          503,
          'Failed to allocate pairing code. Retry shortly.',
        );
      }

      const createdAtMs = now().getTime();
      const expiresAtMs = createdAtMs + ttlSeconds * 1000;
      const session = {
        id: sessionId,
        pairingCode,
        vaultId,
        hostDeviceId,
        status: 'awaiting_join',
        createdAtMs,
        expiresAtMs,
        pendingRequest: null,
        wrappedVaultBundle: null,
      };
      pairingStore.sessionsById.set(sessionId, session);
      pairingStore.sessionsByCode.set(pairingCode, sessionId);

      return res.status(201).json({
        session_id: sessionId,
        pairing_code: pairingCode,
        status: session.status,
        expires_at: toIsoTimestamp(expiresAtMs),
      });
    } catch (error) {
      return sendRouteError(res, error);
    }
  });

  app.post('/pairing/sessions/join', (req, res) => {
    try {
      sweepExpiredPairingSessions(pairingStore, now().getTime());

      const requesterDeviceId = req.body?.requester_device_id;
      validateSafeId(requesterDeviceId, 'requester device id');

      const pairingCode = normalizePairingCode(req.body?.pairing_code);
      const sessionId = pairingStore.sessionsByCode.get(pairingCode);
      if (!sessionId) {
        throw new PairingSessionError(404, 'Pairing code not found.');
      }

      const session = getSessionOrThrow(pairingStore, sessionId, now().getTime());
      if (session.hostDeviceId === requesterDeviceId) {
        throw new PairingSessionError(400, 'Host and requester devices must be different.');
      }

      if (session.status === 'rejected') {
        throw new PairingSessionError(403, 'Pairing request was rejected.');
      }

      if (
        session.pendingRequest &&
        session.pendingRequest.requesterDeviceId !== requesterDeviceId &&
        session.status !== 'approved'
      ) {
        throw new PairingSessionError(
          409,
          'Pairing session already has a pending request.',
        );
      }

      if (
        !session.pendingRequest ||
        session.pendingRequest.requesterDeviceId !== requesterDeviceId
      ) {
        session.pendingRequest = {
          id: `pr_${randomHex(16)}`,
          requesterDeviceId,
          requestedAtMs: now().getTime(),
        };
        session.status = 'pending_approval';
        session.wrappedVaultBundle = null;
      }

      return res.json({
        session_id: session.id,
        request_id: session.pendingRequest.id,
        status: session.status,
        expires_at: toIsoTimestamp(session.expiresAtMs),
      });
    } catch (error) {
      return sendRouteError(res, error);
    }
  });

  app.get('/pairing/sessions/:sessionId', (req, res) => {
    try {
      sweepExpiredPairingSessions(pairingStore, now().getTime());

      const sessionId = req.params.sessionId;
      const hostDeviceId = req.query.host_device_id;
      validateSafeId(sessionId, 'session id');
      if (typeof hostDeviceId !== 'string') {
        throw new RequestValidationError('host_device_id query parameter is required.');
      }

      const session = getSessionOrThrow(pairingStore, sessionId, now().getTime());
      assertHostOwnership(session, hostDeviceId);

      return res.json({
        session_id: session.id,
        status: session.status,
        expires_at: toIsoTimestamp(session.expiresAtMs),
        pending_request: session.pendingRequest
          ? {
              request_id: session.pendingRequest.id,
              requester_device_id: session.pendingRequest.requesterDeviceId,
              requested_at: toIsoTimestamp(session.pendingRequest.requestedAtMs),
            }
          : null,
      });
    } catch (error) {
      return sendRouteError(res, error);
    }
  });

  app.post('/pairing/sessions/:sessionId/approve', (req, res) => {
    try {
      sweepExpiredPairingSessions(pairingStore, now().getTime());

      const sessionId = req.params.sessionId;
      const hostDeviceId = req.body?.host_device_id;
      const requestId = req.body?.request_id;
      const action = req.body?.action ?? 'approve';
      validateSafeId(sessionId, 'session id');
      if (typeof hostDeviceId !== 'string' || typeof requestId !== 'string') {
        throw new RequestValidationError('host_device_id and request_id are required.');
      }

      const session = getSessionOrThrow(pairingStore, sessionId, now().getTime());
      assertHostOwnership(session, hostDeviceId);
      if (!session.pendingRequest || session.pendingRequest.id !== requestId) {
        throw new PairingSessionError(409, 'Pending request does not match this session.');
      }
      if (session.status === 'approved' && session.wrappedVaultBundle) {
        return res.json({
          success: true,
          status: session.status,
          request_id: requestId,
        });
      }

      if (action === 'reject') {
        session.status = 'rejected';
        session.wrappedVaultBundle = null;
        return res.json({
          success: true,
          status: session.status,
          request_id: requestId,
        });
      }

      const wrappedVaultBundle = req.body?.wrapped_vault_bundle;
      if (
        typeof wrappedVaultBundle !== 'string' ||
        wrappedVaultBundle.trim().length === 0
      ) {
        throw new RequestValidationError('wrapped_vault_bundle is required.');
      }
      if (Buffer.byteLength(wrappedVaultBundle, 'utf8') > MAX_WRAPPED_BUNDLE_BYTES) {
        throw new RequestValidationError('wrapped_vault_bundle is too large.');
      }

      session.status = 'approved';
      session.wrappedVaultBundle = wrappedVaultBundle.trim();

      return res.json({
        success: true,
        status: session.status,
        request_id: requestId,
      });
    } catch (error) {
      return sendRouteError(res, error);
    }
  });

  app.get('/pairing/sessions/:sessionId/bundle', (req, res) => {
    try {
      sweepExpiredPairingSessions(pairingStore, now().getTime());

      const sessionId = req.params.sessionId;
      const requestId = req.query.request_id;
      const requesterDeviceId = req.query.requester_device_id;
      validateSafeId(sessionId, 'session id');
      if (typeof requestId !== 'string' || typeof requesterDeviceId !== 'string') {
        throw new RequestValidationError(
          'request_id and requester_device_id query parameters are required.',
        );
      }

      const session = getSessionOrThrow(pairingStore, sessionId, now().getTime());
      assertRequesterOwnership(session, requesterDeviceId, requestId);

      if (session.status === 'pending_approval' || session.status === 'awaiting_join') {
        return res.status(202).json({ status: 'pending_approval' });
      }
      if (session.status === 'rejected') {
        return res.status(403).json({ status: 'rejected' });
      }
      if (session.status !== 'approved' || !session.wrappedVaultBundle) {
        throw new PairingSessionError(409, 'Pairing bundle is not ready.');
      }

      return res.json({
        status: 'approved',
        wrapped_vault_bundle: session.wrappedVaultBundle,
      });
    } catch (error) {
      return sendRouteError(res, error);
    }
  });

  app.get('/vaults/:vaultId/sync', (req, res) => {
    try {
      const vaultId = req.params.vaultId;
      const since = parseSinceVersion(req.query.since);
      const vault = loadVault(dataDir, vaultId);

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
      const vault = loadVault(dataDir, vaultId);
      const plannedWrite = buildNextVaultState(vault, pushes);

      if (!plannedWrite.ok) {
        logMessage(
          logger,
          'warn',
          `[409 Conflict:${plannedWrite.conflict.conflict_type}] item ${plannedWrite.conflict.item_id}. Expected ${plannedWrite.conflict.your_base}, got ${plannedWrite.conflict.server_actual}`,
        );
        return res.status(409).json(plannedWrite.conflict);
      }

      saveVault(dataDir, vaultId, plannedWrite.vault);

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

  app.get('/sync/version', (req, res) => {
    res.json({ version: 0, status: 'deprecated, please access /vaults' });
  });

  app.use((error, req, res, next) => {
    if (error?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'JSON body too large' });
    }
    if (error instanceof SyntaxError && 'body' in error) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    logMessage(logger, 'error', `[Internal Error] ${error?.stack || error}`);
    return res.status(500).json({ error: 'Internal server error' });
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  return app;
}

function startServer({ port = DEFAULT_PORT, dataDir } = {}) {
  const app = createApp({ dataDir });
  const server = app.listen(port, () => {
    console.log('--------------------------------------------------');
    console.log('    SecretRoy Distributed Vault Server (Dumb)     ');
    console.log(`    Running on http://localhost:${port}           `);
    console.log('    E2EE Enabled | JSON Document Store Mode       ');
    console.log('--------------------------------------------------');
  });

  const shutdown = (signal) => {
    console.log(`[${signal}] Closing SecretRoy sync server...`);
    server.close(() => {
      console.log('SecretRoy sync server closed.');
      process.exit(0);
    });
    setTimeout(() => {
      console.error('Forced shutdown after timeout.');
      process.exit(1);
    }, 5000).unref();
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  buildNextVaultState,
  createApp,
  createEmptyVault,
  createRateLimitMiddleware,
  getVaultPath,
  loadVault,
  normalizePairingCode,
  parseIntegerOption,
  parseSinceVersion,
  saveVault,
  startServer,
  buildConflictResponse,
  validatePushes,
};
