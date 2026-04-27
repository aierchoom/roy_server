function toIsoTimestamp(timestampMs) {
  return new Date(timestampMs).toISOString();
}

module.exports = {
  toIsoTimestamp,
};
