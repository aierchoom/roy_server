const { RequestValidationError } = require('../errors');

function parseSinceVersion(rawValue) {
  const parsed = Number.parseInt(String(rawValue ?? '0'), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new RequestValidationError('Invalid since version');
  }
  return parsed;
}

module.exports = {
  parseSinceVersion,
};
