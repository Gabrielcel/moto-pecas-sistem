const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;
if (env.smtp.host) {
  transporter = nodemailer.createTransport({
    host: env.smtp.host, port: env.smtp.port, secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
}

async function sendMail({ to, subject, text, html }) {
  if (!transporter) {
    console.log(`[email] SMTP não configurado. Para: ${to} | Assunto: ${subject}\n${text}`);
    return { sent: false };
  }
  await transporter.sendMail({ from: env.smtp.from, to, subject, text, html });
  return { sent: true };
}
module.exports = { sendMail };
