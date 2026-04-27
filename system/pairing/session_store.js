const { MAX_PAIRING_SESSIONS } = require('../config');
const { PairingSessionError } = require('../errors');

function createPairingStore() {
  return {
    sessionsById: new Map(),
    sessionsByCode: new Map(),
  };
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

module.exports = {
  assertPairingCapacity,
  createPairingStore,
  getSessionOrThrow,
  sweepExpiredPairingSessions,
};
