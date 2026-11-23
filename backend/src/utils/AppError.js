class AppError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.status = status;
    this.code = code || 'error';
    this.details = details;
  }
}
const badRequest = (m, d) => new AppError(400, m, 'bad_request', d);
const unauthorized = (m = 'Não autenticado') => new AppError(401, m, 'unauthorized');
const forbidden = (m = 'Acesso não permitido') => new AppError(403, m, 'forbidden');
const notFound = (m = 'Recurso não encontrado') => new AppError(404, m, 'not_found');
const conflict = (m, d) => new AppError(409, m, 'conflict', d);
const unprocessable = (m, d) => new AppError(422, m, 'validation_error', d);
module.exports = { AppError, badRequest, unauthorized, forbidden, notFound, conflict, unprocessable };
