const { PairingSessionError, RequestValidationError } = require('../../errors');
const { sendRouteError } = require('../../http');
const {
  assertRequesterOwnership,
  getSessionOrThrow,
  sweepExpiredPairingSessions,
} = require('../../pairing');
const { validateSafeId } = require('../../validation');

function registerGetPairingBundleRoute(app, { pairingStore, now }) {
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

      const wrappedVaultBundle = session.wrappedVaultBundle;
      pairingStore.sessionsById.delete(session.id);
      pairingStore.sessionsByCode.delete(session.pairingCode);

      return res.json({
        status: 'approved',
        wrapped_vault_bundle: wrappedVaultBundle,
      });
    } catch (error) {
      return sendRouteError(res, error);
    }
  });
}

module.exports = {
  registerGetPairingBundleRoute,
};
