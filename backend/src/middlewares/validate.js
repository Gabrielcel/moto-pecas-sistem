const { unprocessable } = require('../utils/AppError');

/** validate({ body, query, params }) — schemas zod. Resultado em req.valid.{body,query,params}. */
const validate = (schemas) => (req, res, next) => {
  req.valid = {};
  const issues = [];
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const r = schemas[part].safeParse(req[part] || {});
    if (r.success) req.valid[part] = r.data;
    else r.error.issues.forEach((i) => issues.push({ field: [part !== 'body' ? part : null, ...i.path].filter(Boolean).join('.'), message: i.message }));
  }
  if (issues.length) return next(unprocessable('Dados inválidos', issues));
  next();
};
module.exports = { validate };
