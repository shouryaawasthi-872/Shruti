// Small typed error so controllers/middleware can reject with an HTTP status
// without hard-coding response shaping in every place.
class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

module.exports = HttpError;
