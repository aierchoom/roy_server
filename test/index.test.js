const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const {
  buildNextVaultState,
  buildConflictResponse,
  cleanupStaleVaultTempFiles,
  configureServerTimeouts,
  createApp,
  createEmptyVault,
  getVaultPath,
  loadVault,
  normalizePairingCode,
  parseIntegerOption,
  saveVault,
  validatePushes,
} = require('../index.js');

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'secretroy-sync-'));
}

test('getVaultPath rejects unsafe vault ids', () => {
  assert.throws(
    () => getVaultPath('C:\\temp', '../escape'),
    /Invalid vault id format/,
  );
});

test('saveVault persists a vault that loadVault can read back', () => {
  const dataDir = createTempDir();
  const vaultId = 'vault_123';
  const vault = createEmptyVault();
  vault.currentVersion = 2;
  vault.items.item_1 = {
    id: 'item_1',
    version: 2,
    encrypted_signed_payload: 'ciphertext',
    is_deleted: false,
  };

  saveVault(dataDir, vaultId, vault);
  const loaded = loadVault(dataDir, vaultId);

  assert.deepEqual(loaded, vault);
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('loadVault recovers from backup when the primary file is missing', () => {
  const dataDir = createTempDir();
  const vaultId = 'vault_123';
  const vaultPath = getVaultPath(dataDir, vaultId);
  const backupPath = `${vaultPath}.bak`;
  const snapshot = {
    currentVersion: 4,
    items: {
      item_1: {
        id: 'item_1',
        version: 4,
        encrypted_signed_payload: 'ciphertext',
        is_deleted: false,
      },
    },
  };

  fs.writeFileSync(backupPath, JSON.stringify(snapshot, null, 2), 'utf8');

  const loaded = loadVault(dataDir, vaultId);

  assert.deepEqual(loaded, snapshot);
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('loadVault falls back to backup when the primary file is unreadable', () => {
  const dataDir = createTempDir();
  const vaultId = 'vault_123';
  const vaultPath = getVaultPath(dataDir, vaultId);
  const backupPath = `${vaultPath}.bak`;
  const snapshot = {
    currentVersion: 4,
    items: {
      item_1: {
        id: 'item_1',
        version: 4,
        encrypted_signed_payload: 'ciphertext',
        is_deleted: false,
      },
    },
  };

  fs.writeFileSync(vaultPath, '{broken-json', 'utf8');
  fs.writeFileSync(backupPath, JSON.stringify(snapshot, null, 2), 'utf8');

  const loaded = loadVault(dataDir, vaultId);

  assert.deepEqual(loaded, snapshot);
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('loadVault rejects malformed stored item documents', () => {
  const dataDir = createTempDir();
  const vaultId = 'vault_123';
  const vaultPath = getVaultPath(dataDir, vaultId);
  fs.writeFileSync(
    vaultPath,
    JSON.stringify({
      currentVersion: 1,
      items: {
        item_1: {
          id: 'different_item_id',
          version: 1,
          encrypted_signed_payload: 'ciphertext',
          is_deleted: false,
        },
      },
    }),
    'utf8',
  );

  assert.throws(() => loadVault(dataDir, vaultId), /Vault file is unreadable/);
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('loadVault rejects oversized vault files before parsing', () => {
  const dataDir = createTempDir();
  const vaultId = 'vault_123';
  const vaultPath = getVaultPath(dataDir, vaultId);
  fs.writeFileSync(
    vaultPath,
    JSON.stringify({
      currentVersion: 1,
      items: {},
    }),
    'utf8',
  );

  assert.throws(
    () => loadVault(dataDir, vaultId, { maxVaultFileBytes: 8 }),
    /Vault file is unreadable/,
  );
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('saveVault rejects documents over the configured vault file limit', () => {
  const dataDir = createTempDir();
  const vaultId = 'vault_123';
  const vault = createEmptyVault();
  vault.currentVersion = 1;
  vault.items.item_1 = {
    id: 'item_1',
    version: 1,
    encrypted_signed_payload: 'x'.repeat(256),
    is_deleted: false,
  };

  assert.throws(
    () => saveVault(dataDir, vaultId, vault, { maxVaultFileBytes: 64 }),
    /Vault file too large/,
  );
  assert.equal(fs.existsSync(getVaultPath(dataDir, vaultId)), false);
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('cleanupStaleVaultTempFiles removes old temp files only', () => {
  const dataDir = createTempDir();
  const stalePath = path.join(dataDir, 'vault_vault_123.json.111.tmp');
  const freshPath = path.join(dataDir, 'vault_vault_456.json.222.tmp');
  const ignoredPath = path.join(dataDir, 'random.tmp');
  fs.writeFileSync(stalePath, 'stale', 'utf8');
  fs.writeFileSync(freshPath, 'fresh', 'utf8');
  fs.writeFileSync(ignoredPath, 'ignored', 'utf8');

  const nowMs = Date.parse('2026-04-28T00:00:00.000Z');
  fs.utimesSync(stalePath, new Date(nowMs - 5000), new Date(nowMs - 5000));
  fs.utimesSync(freshPath, new Date(nowMs - 250), new Date(nowMs - 250));

  const removedCount = cleanupStaleVaultTempFiles(dataDir, {
    nowMs,
    maxAgeMs: 1000,
  });

  assert.equal(removedCount, 1);
  assert.equal(fs.existsSync(stalePath), false);
  assert.equal(fs.existsSync(freshPath), true);
  assert.equal(fs.existsSync(ignoredPath), true);
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('configureServerTimeouts applies bounded HTTP timeout values', () => {
  const server = http.createServer();

  const applied = configureServerTimeouts(server, {
    requestTimeoutMs: 3000,
    headersTimeoutMs: 9000,
    keepAliveTimeoutMs: 2000,
  });

  assert.deepEqual(applied, {
    requestTimeoutMs: 3000,
    headersTimeoutMs: 3000,
    keepAliveTimeoutMs: 2000,
  });
  assert.equal(server.requestTimeout, 3000);
  assert.equal(server.headersTimeout, 3000);
  assert.equal(server.keepAliveTimeout, 2000);
  assert.equal(server.maxHeadersCount, 100);
  server.close();
});

test('createApp refuses data paths that are not directories', () => {
  const dataDir = createTempDir();
  const filePath = path.join(dataDir, 'not-a-directory');
  fs.writeFileSync(filePath, 'file', 'utf8');

  assert.throws(
    () =>
      createApp({
        dataDir: filePath,
        logger: { info() {}, warn() {}, log() {}, error() {} },
      }),
    /Data path is not a directory/,
  );
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('validatePushes rejects duplicate ids and invalid base versions', () => {
  assert.throws(
    () =>
      validatePushes([
        {
          id: 'item_1',
          expected_base_version: 0,
          encrypted_signed_payload: 'a',
        },
        {
          id: 'item_1',
          expected_base_version: 0,
          encrypted_signed_payload: 'b',
        },
      ]),
    /Duplicate item id/,
  );

  assert.throws(
    () =>
      validatePushes([
        {
          id: 'item_2',
          expected_base_version: -1,
          encrypted_signed_payload: 'a',
        },
      ]),
    /Invalid expected_base_version/,
  );
});

test('buildNextVaultState applies a batch on a cloned next state', () => {
  const vault = {
    currentVersion: 2,
    items: {
      item_1: {
        id: 'item_1',
        version: 2,
        encrypted_signed_payload: 'old',
        is_deleted: false,
      },
    },
  };

  const result = buildNextVaultState(vault, [
    {
      id: 'item_1',
      expected_base_version: 2,
      encrypted_signed_payload: 'new-1',
      is_deleted: false,
    },
    {
      id: 'item_2',
      expected_base_version: 0,
      encrypted_signed_payload: 'new-2',
      is_deleted: true,
    },
  ]);

  assert.equal(result.ok, true);
  assert.equal(vault.currentVersion, 2);
  assert.equal(vault.items.item_1.version, 2);
  assert.deepEqual(result.acceptedVersions, { item_1: 3, item_2: 4 });
  assert.equal(result.vault.currentVersion, 4);
  assert.equal(result.vault.items.item_1.version, 3);
  assert.equal(result.vault.items.item_2.version, 4);
});

test('buildNextVaultState rejects conflicting batches without mutating the source vault', () => {
  const vault = {
    currentVersion: 2,
    items: {
      item_1: {
        id: 'item_1',
        version: 2,
        encrypted_signed_payload: 'old',
        is_deleted: false,
      },
    },
  };

  const result = buildNextVaultState(vault, [
    {
      id: 'item_1',
      expected_base_version: 1,
      encrypted_signed_payload: 'new',
      is_deleted: false,
    },
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.conflict.conflict_type, 'stale_base_version');
  assert.equal(vault.currentVersion, 2);
  assert.equal(vault.items.item_1.version, 2);
  assert.equal(vault.items.item_1.encrypted_signed_payload, 'old');
});

test('buildConflictResponse classifies remote missing conflicts', () => {
  const response = buildConflictResponse(
    {
      id: 'item_1',
      expected_base_version: 3,
      is_deleted: false,
    },
    undefined,
  );

  assert.equal(response.conflict_type, 'remote_missing');
  assert.equal(response.server_actual, 0);
  assert.equal(response.server_is_deleted, false);
});

test('buildConflictResponse classifies concurrent edit conflicts', () => {
  const response = buildConflictResponse(
    {
      id: 'item_1',
      expected_base_version: 0,
      is_deleted: false,
    },
    {
      id: 'item_1',
      version: 5,
      is_deleted: false,
    },
  );

  assert.equal(response.conflict_type, 'concurrent_edit');
  assert.equal(response.server_actual, 5);
  assert.equal(response.server_is_deleted, false);
});

test('buildConflictResponse classifies concurrent delete conflicts', () => {
  const response = buildConflictResponse(
    {
      id: 'item_1',
      expected_base_version: 4,
      is_deleted: false,
    },
    {
      id: 'item_1',
      version: 6,
      is_deleted: true,
    },
  );

  assert.equal(response.conflict_type, 'concurrent_delete');
  assert.equal(response.server_actual, 6);
  assert.equal(response.server_is_deleted, true);
});

test('normalizePairingCode rejects ambiguous and malformed codes', () => {
  assert.equal(normalizePairingCode('abcd 2345'), 'ABCD2345');
  assert.throws(() => normalizePairingCode('ABCDEF10'), /Invalid pairing code/);
  assert.throws(() => normalizePairingCode('ABC123'), /Invalid pairing code/);
});

test('parseIntegerOption falls back for malformed or out-of-range values', () => {
  assert.equal(parseIntegerOption(undefined, 8080, { min: 1, max: 65535 }), 8080);
  assert.equal(parseIntegerOption('abc', 8080, { min: 1, max: 65535 }), 8080);
  assert.equal(parseIntegerOption('0', 8080, { min: 1, max: 65535 }), 8080);
  assert.equal(parseIntegerOption('65536', 8080, { min: 1, max: 65535 }), 8080);
  assert.equal(parseIntegerOption('3000', 8080, { min: 1, max: 65535 }), 3000);
});

test('createApp surfaces unreadable vault files as persistence errors', async () => {
  const dataDir = createTempDir();
  const vaultId = 'vault_123';
  const vaultPath = getVaultPath(dataDir, vaultId);
  fs.writeFileSync(vaultPath, '{broken-json', 'utf8');

  const app = createApp({
    dataDir,
    logger: { info() {}, warn() {}, log() {} },
    now: () => new Date('2026-04-22T00:00:00.000Z'),
  });
  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/vaults/${vaultId}/sync?since=0`,
    );
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.match(body.error, /Vault file is unreadable/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('createApp returns security headers and JSON 404 responses', async () => {
  const dataDir = createTempDir();
  const app = createApp({
    dataDir,
    logger: { info() {}, warn() {}, log() {}, error() {} },
  });
  const server = app.listen(0);

  try {
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const healthResponse = await fetch(`${baseUrl}/healthz`);
    assert.equal(healthResponse.status, 200);
    assert.equal(healthResponse.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(healthResponse.headers.get('x-frame-options'), 'DENY');
    assert.equal(healthResponse.headers.get('cache-control'), 'no-store');
    assert.match(healthResponse.headers.get('x-request-id'), /^req_[a-f0-9]{12}$/);
    assert.equal(healthResponse.headers.get('x-powered-by'), null);

    const customIdResponse = await fetch(`${baseUrl}/healthz`, {
      headers: { 'X-Request-Id': 'client.request-1' },
    });
    assert.equal(customIdResponse.status, 200);
    assert.equal(customIdResponse.headers.get('x-request-id'), 'client.request-1');

    const missingResponse = await fetch(`${baseUrl}/missing-route`);
    assert.equal(missingResponse.status, 404);
    assert.deepEqual(await missingResponse.json(), { error: 'Route not found' });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('createApp rate limits repeated requests from one client', async () => {
  const dataDir = createTempDir();
  const app = createApp({
    dataDir,
    logger: { info() {}, warn() {}, log() {}, error() {} },
    now: () => new Date('2026-04-25T00:00:00.000Z'),
    maxRequestsPerWindow: 1,
  });
  const server = app.listen(0);

  try {
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const firstResponse = await fetch(`${baseUrl}/healthz`);
    assert.equal(firstResponse.status, 200);
    assert.equal(firstResponse.headers.get('ratelimit-limit'), '1');
    assert.equal(firstResponse.headers.get('ratelimit-remaining'), '0');

    const secondResponse = await fetch(`${baseUrl}/healthz`);
    assert.equal(secondResponse.status, 429);
    assert.deepEqual(await secondResponse.json(), { error: 'Too many requests' });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('createApp rejects non-json and malformed json request bodies', async () => {
  const dataDir = createTempDir();
  const app = createApp({
    dataDir,
    logger: { info() {}, warn() {}, log() {}, error() {} },
  });
  const server = app.listen(0);

  try {
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const textResponse = await fetch(`${baseUrl}/pairing/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'not-json',
    });
    assert.equal(textResponse.status, 415);
    assert.match((await textResponse.json()).error, /application\/json/);

    const malformedResponse = await fetch(`${baseUrl}/pairing/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad-json',
    });
    assert.equal(malformedResponse.status, 400);
    assert.deepEqual(await malformedResponse.json(), {
      error: 'Invalid JSON body',
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('createApp returns 413 when a sync push exceeds the vault file limit', async () => {
  const dataDir = createTempDir();
  const app = createApp({
    dataDir,
    logger: { info() {}, warn() {}, log() {}, error() {} },
    maxVaultFileBytes: 128,
  });
  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/vaults/vault_123/sync`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pushes: [
            {
              id: 'item_1',
              expected_base_version: 0,
              encrypted_signed_payload: 'x'.repeat(128),
            },
          ],
        }),
      },
    );

    assert.equal(response.status, 413);
    assert.match((await response.json()).error, /Vault file too large/);
    assert.equal(fs.existsSync(getVaultPath(dataDir, 'vault_123')), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('pairing session lifecycle creates, joins, approves, and fetches bundle', async () => {
  const dataDir = createTempDir();
  const app = createApp({
    dataDir,
    logger: { info() {}, warn() {}, log() {} },
    now: () => new Date('2026-04-25T00:00:00.000Z'),
  });
  const server = app.listen(0);

  try {
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const hostDeviceId = 'device_abcdef123456';
    const requesterDeviceId = 'device_123456abcdef';
    const requesterPublicKey = 'q'.repeat(43);
    const encryptedBundle = `sroy-pairing:${'b'.repeat(64)}`;

    const createResponse = await fetch(`${baseUrl}/pairing/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vault_id: 'vault_abc123',
        host_device_id: hostDeviceId,
      }),
    });
    assert.equal(createResponse.status, 201);
    const createdSession = await createResponse.json();
    assert.match(createdSession.session_id, /^ps_[a-f0-9]{16}$/);
    assert.match(createdSession.pairing_code, /^[A-Z0-9]{8}$/);

    const joinResponse = await fetch(`${baseUrl}/pairing/sessions/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pairing_code: createdSession.pairing_code,
        requester_device_id: requesterDeviceId,
        requester_public_key: requesterPublicKey,
      }),
    });
    assert.equal(joinResponse.status, 200);
    const joinBody = await joinResponse.json();
    assert.equal(joinBody.status, 'pending_approval');
    assert.match(joinBody.request_id, /^pr_[a-f0-9]{16}$/);

    const hostStatusResponse = await fetch(
      `${baseUrl}/pairing/sessions/${createdSession.session_id}?host_device_id=${hostDeviceId}`,
    );
    assert.equal(hostStatusResponse.status, 200);
    const hostStatus = await hostStatusResponse.json();
    assert.equal(hostStatus.pending_request.request_id, joinBody.request_id);
    assert.equal(
      hostStatus.pending_request.requester_device_id,
      requesterDeviceId,
    );
    assert.equal(
      hostStatus.pending_request.requester_public_key,
      requesterPublicKey,
    );

    const approveResponse = await fetch(
      `${baseUrl}/pairing/sessions/${createdSession.session_id}/approve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host_device_id: hostDeviceId,
          request_id: joinBody.request_id,
          wrapped_vault_bundle: encryptedBundle,
        }),
      },
    );
    assert.equal(approveResponse.status, 200);
    const approveBody = await approveResponse.json();
    assert.equal(approveBody.status, 'approved');

    const bundleResponse = await fetch(
      `${baseUrl}/pairing/sessions/${createdSession.session_id}/bundle?request_id=${joinBody.request_id}&requester_device_id=${requesterDeviceId}`,
    );
    assert.equal(bundleResponse.status, 200);
    const bundleBody = await bundleResponse.json();
    assert.equal(bundleBody.status, 'approved');
    assert.equal(bundleBody.wrapped_vault_bundle, encryptedBundle);

    const secondBundleResponse = await fetch(
      `${baseUrl}/pairing/sessions/${createdSession.session_id}/bundle?request_id=${joinBody.request_id}&requester_device_id=${requesterDeviceId}`,
    );
    assert.equal(secondBundleResponse.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('pairing approve rejects plaintext transfer codes', async () => {
  const dataDir = createTempDir();
  const app = createApp({
    dataDir,
    logger: { info() {}, warn() {}, log() {}, error() {} },
  });
  const server = app.listen(0);

  try {
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const hostDeviceId = 'device_abcdef123456';
    const requesterDeviceId = 'device_123456abcdef';

    const createResponse = await fetch(`${baseUrl}/pairing/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vault_id: 'vault_abc123',
        host_device_id: hostDeviceId,
      }),
    });
    const createdSession = await createResponse.json();

    const joinResponse = await fetch(`${baseUrl}/pairing/sessions/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pairing_code: createdSession.pairing_code,
        requester_device_id: requesterDeviceId,
        requester_public_key: 'q'.repeat(43),
      }),
    });
    const joinBody = await joinResponse.json();

    const approveResponse = await fetch(
      `${baseUrl}/pairing/sessions/${createdSession.session_id}/approve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host_device_id: hostDeviceId,
          request_id: joinBody.request_id,
          wrapped_vault_bundle: 'sroy-link:dGVzdA',
        }),
      },
    );

    assert.equal(approveResponse.status, 400);
    assert.match((await approveResponse.json()).error, /encrypted pairing bundle/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('pairing join rejects malformed code before lookup', async () => {
  const dataDir = createTempDir();
  const app = createApp({
    dataDir,
    logger: { info() {}, warn() {}, log() {}, error() {} },
  });
  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/pairing/sessions/join`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairing_code: 'ABCDEF10',
          requester_device_id: 'device_abcdef123456',
          requester_public_key: 'q'.repeat(43),
        }),
      },
    );
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Invalid pairing code/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('pairing join requires requester public key', async () => {
  const dataDir = createTempDir();
  const app = createApp({
    dataDir,
    logger: { info() {}, warn() {}, log() {}, error() {} },
  });
  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/pairing/sessions/join`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairing_code: 'ABCDEFGH',
          requester_device_id: 'device_abcdef123456',
        }),
      },
    );
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /requester_public_key/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('pairing join fails with unknown code', async () => {
  const dataDir = createTempDir();
  const app = createApp({
    dataDir,
    logger: { info() {}, warn() {}, log() {} },
  });
  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/pairing/sessions/join`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairing_code: 'ABCDEFGH',
          requester_device_id: 'device_abcdef123456',
          requester_public_key: 'q'.repeat(43),
        }),
      },
    );
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.match(body.error, /Pairing code not found/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
