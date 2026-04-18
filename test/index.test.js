const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildNextVaultState,
  buildConflictResponse,
  createApp,
  createEmptyVault,
  getVaultPath,
  loadVault,
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

    const approveResponse = await fetch(
      `${baseUrl}/pairing/sessions/${createdSession.session_id}/approve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host_device_id: hostDeviceId,
          request_id: joinBody.request_id,
          wrapped_vault_bundle: 'sroy-link-v1:dGVzdA',
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
    assert.equal(bundleBody.wrapped_vault_bundle, 'sroy-link-v1:dGVzdA');
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
