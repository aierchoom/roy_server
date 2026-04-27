const { PairingSessionError } = require('../errors');
const { validateSafeId } = require('../validation');

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

module.exports = {
  assertHostOwnership,
  assertRequesterOwnership,
};
