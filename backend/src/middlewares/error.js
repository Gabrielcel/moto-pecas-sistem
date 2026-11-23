const { AppError } = require('../utils/AppError');

const notFoundHandler = (req, res) =>
  res.status(404).json({ success: false, error: { code: 'not_found', message: 'Rota não encontrada' } });

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = 500; let code = 'internal_error'; let message = 'Erro interno do servidor'; let details;
  if (err instanceof AppError) { status = err.status; code = err.code; message = err.message; details = err.details; }
  else if (err.code === 'LIMIT_FILE_SIZE') { status = 422; code = 'file_too_large'; message = 'Arquivo maior que o limite de 5 MB'; }
  else if (err.name === 'MulterError') { status = 422; code = 'upload_error'; message = 'Erro no envio do arquivo'; }
  else if (err.type === 'entity.parse.failed') { status = 400; code = 'bad_json'; message = 'JSON inválido'; }
  else if (err.code === '23505') { status = 409; code = 'duplicate'; message = 'Registro duplicado'; }
  else if (err.code === '23503') { status = 409; code = 'in_use'; message = 'Registro vinculado a outros dados'; }
  else if (err.code === '23514' || err.code === '22P02' || err.code === '22003') { status = 422; code = 'constraint'; message = 'Dados fora das regras permitidas'; }
  else if (err.code === '40001' || err.code === '40P01') { status = 409; code = 'concurrency'; message = 'Operação concorrente, tente novamente'; }
  if (status >= 500) console.error('[erro]', req.method, req.originalUrl, err);
  res.status(status).json({ success: false, error: { code, message, ...(details ? { details } : {}) } });
};
module.exports = { notFoundHandler, errorHandler };
