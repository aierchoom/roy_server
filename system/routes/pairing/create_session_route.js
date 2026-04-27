const { sendRouteError } = require('../../http');
const { randomHex } = require('../../ids');
const {
  allocatePairingCode,
  assertPairingCapacity,
  parsePairingTtlSeconds,
  sweepExpiredPairingSessions,
  toIsoTimestamp,
} = require('../../pairing');
const { validateSafeId } = require('../../validation');

function registerCreatePairingSessionRoute(app, { pairingStore, now }) {
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
      const pairingCode = allocatePairingCode(pairingStore);
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
}

module.exports = {
  registerCreatePairingSessionRoute,
};
