const { MAX_WRAPPED_BUNDLE_BYTES } = require('../../config');
const { PairingSessionError, RequestValidationError } = require('../../errors');
const { sendRouteError } = require('../../http');
const {
  assertHostOwnership,
  getSessionOrThrow,
  sweepExpiredPairingSessions,
} = require('../../pairing');
const { validateSafeId } = require('../../validation');

function registerApprovePairingSessionRoute(app, { pairingStore, now }) {
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
      if (!wrappedVaultBundle.trim().startsWith('sroy-pairing-v2:')) {
        throw new RequestValidationError(
          'wrapped_vault_bundle must be an encrypted pairing bundle.',
        );
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
}

module.exports = {
  registerApprovePairingSessionRoute,
};
