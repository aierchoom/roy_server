const { RequestValidationError } = require('../../errors');
const { sendRouteError } = require('../../http');
const {
  assertHostOwnership,
  getSessionOrThrow,
  sweepExpiredPairingSessions,
  toIsoTimestamp,
} = require('../../pairing');
const { validateSafeId } = require('../../validation');

function registerGetPairingSessionRoute(app, { pairingStore, now }) {
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
}

module.exports = {
  registerGetPairingSessionRoute,
};
