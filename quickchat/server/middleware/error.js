class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function notFound(req, res) {
  res.status(404).json({ message: 'Not found', code: 'NOT_FOUND' });
}

function errorHandler(err, req, res, next) {
  const status = Number(err && err.status) || 500;

  if (status >= 500) {
    console.error('[http] unhandled error', err);
  }

  res.status(status).json({
    message: status >= 500 ? 'Internal server error' : err.message,
    code: (err && err.code) || (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST'),
  });
}

module.exports = { HttpError, asyncHandler, notFound, errorHandler };
