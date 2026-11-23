const { z } = require('zod');
const password = z.string().min(8, 'A senha deve ter ao menos 8 caracteres').max(100)
  .regex(/[A-Za-z]/, 'A senha deve conter letras').regex(/\d/, 'A senha deve conter números');
module.exports = {
  password,
  login: { body: z.object({ email: z.string().email().max(180), password: z.string().min(1).max(100) }) },
  changePassword: { body: z.object({ current_password: z.string().min(1), new_password: password }) },
  forgot: { body: z.object({ email: z.string().email().max(180) }) },
  reset: { body: z.object({ token: z.string().min(20).max(200), new_password: password }) },
};
