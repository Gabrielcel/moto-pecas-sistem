const { z } = require('zod');
const { password } = require('../auth/auth.validation');
const id = z.object({ id: z.coerce.number().int().positive() });
const roleIds = z.array(z.number().int().positive()).min(1, 'Informe ao menos uma função');
module.exports = {
  id: { params: id },
  create: { body: z.object({ name: z.string().min(2).max(150), email: z.string().email().max(180), password, role_ids: roleIds }) },
  update: { params: id, body: z.object({ name: z.string().min(2).max(150), email: z.string().email().max(180), role_ids: roleIds }).partial() },
  status: { params: id, body: z.object({ status: z.enum(['ativo', 'bloqueado']) }) },
  resetPassword: { params: id, body: z.object({ password }) },
  roleBody: { body: z.object({ name: z.string().min(2).max(80), description: z.string().max(300).optional().nullable(), permission_ids: z.array(z.number().int().positive()) }) },
  roleUpdate: { params: id, body: z.object({ name: z.string().min(2).max(80), description: z.string().max(300).optional().nullable(), permission_ids: z.array(z.number().int().positive()) }) },
};
