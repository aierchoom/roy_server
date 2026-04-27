class RequestValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

class VaultPersistenceError extends Error {}

class PairingSessionError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = {
  PairingSessionError,
  RequestValidationError,
  VaultPersistenceError,
};
