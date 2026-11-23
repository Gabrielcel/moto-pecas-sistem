const { createBackup } = require('../src/services/backup.service');
createBackup().then((f) => console.log('Backup criado:', f)).catch((e) => { console.error('Falha no backup:', e.message); process.exit(1); });
