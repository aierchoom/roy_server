function parseIntegerOption(rawValue, fallback, { min, max } = {}) {
  if (rawValue == null || rawValue === '') {
    return fallback;
  }
  const parsed = Number.parseInt(String(rawValue), 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  if (Number.isInteger(min) && parsed < min) {
    return fallback;
  }
  if (Number.isInteger(max) && parsed > max) {
    return fallback;
  }
  return parsed;
}

module.exports = {
  parseIntegerOption,
};
