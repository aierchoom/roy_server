const {
  PAIRING_CODE_ALPHABET,
  PAIRING_CODE_PATTERN,
} = require('../config');
const { PairingSessionError, RequestValidationError } = require('../errors');
const { randomHex } = require('../ids');

function generatePairingCode() {
  let code = '';
  const unbiasedLimit =
    Math.floor(256 / PAIRING_CODE_ALPHABET.length) * PAIRING_CODE_ALPHABET.length;
  while (code.length < 8) {
    let randomValue = randomByte();
    while (randomValue >= unbiasedLimit) {
      randomValue = randomByte();
    }
    randomValue %= PAIRING_CODE_ALPHABET.length;
    code += PAIRING_CODE_ALPHABET[randomValue];
  }
  return code;
}

function randomByte() {
  return Number.parseInt(randomHex(2), 16);
}

function normalizePairingCode(rawPairingCode) {
  if (typeof rawPairingCode !== 'string' || rawPairingCode.trim().length === 0) {
    throw new RequestValidationError('Pairing code is required.');
  }
  const pairingCode = rawPairingCode.replace(/\s+/g, '').toUpperCase();
  if (!PAIRING_CODE_PATTERN.test(pairingCode)) {
    throw new RequestValidationError('Invalid pairing code format.');
  }
  return pairingCode;
}

function allocatePairingCode(store) {
  for (let index = 0; index < 12; index += 1) {
    const candidate = generatePairingCode();
    if (!store.sessionsByCode.has(candidate)) {
      return candidate;
    }
  }
  throw new PairingSessionError(
    503,
    'Failed to allocate pairing code. Retry shortly.',
  );
}

module.exports = {
  allocatePairingCode,
  generatePairingCode,
  normalizePairingCode,
};
