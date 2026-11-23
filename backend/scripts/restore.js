// Uso: npm run restore -- caminho/do/arquivo.dump   (SOBRESCREVE os dados atuais!)
const { restoreBackup } = require('../src/services/backup.service');
const file = process.argv[2];
if (!file) { console.error('Informe o arquivo .dump'); process.exit(1); }
restoreBackup(file).then(() => console.log('Restauração concluída.')).catch((e) => { console.error('Falha:', e.message); process.exit(1); });
