const { randomHex } = require('../ids');

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

module.exports = {
  resolveRequestId,
};
