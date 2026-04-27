const { PairingSessionError } = require('../../errors');
const { sendRouteError } = require('../../http');
const { randomHex } = require('../../ids');
const {
  getSessionOrThrow,
  normalizePairingCode,
  sweepExpiredPairingSessions,
  toIsoTimestamp,
} = require('../../pairing');
const { validateSafeId } = require('../../validation');

function registerJoinPairingSessionRoute(app, { pairingStore, now }) {
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
}

module.exports = {
  registerJoinPairingSessionRoute,
};
