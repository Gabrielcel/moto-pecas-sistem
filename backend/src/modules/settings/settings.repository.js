const { query } = require('../../database/pool');
const getAll = async () => Object.fromEntries((await query('SELECT setting_key, setting_value FROM store_settings')).rows.map((r) => [r.setting_key, r.setting_value]));
const set = (key, value, userId, client) => (client || { query }).query(
  `INSERT INTO store_settings (setting_key, setting_value, updated_by) VALUES ($1,$2,$3)
   ON CONFLICT (setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value, updated_at=now(), updated_by=EXCLUDED.updated_by`,
  [key, value, userId || null]);
module.exports = { getAll, set };
