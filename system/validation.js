const { SAFE_ID_PATTERN } = require('./config');
const { RequestValidationError } = require('./errors');

function validateSafeId(value, label) {
  if (typeof value !== 'string' || !SAFE_ID_PATTERN.test(value)) {
    throw new RequestValidationError(`Invalid ${label} format`);
  }
}

module.exports = {
  validateSafeId,
};
