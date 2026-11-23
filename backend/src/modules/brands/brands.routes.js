const { z } = require('zod');
module.exports = require('../../utils/simpleCrud')({
  table: 'brands', entity: 'fabricante', permission: 'products.manage', cols: ['name', 'status'], orderBy: 't.name',
  usedBy: ['SELECT 1 FROM products WHERE brand_id=$1 LIMIT 1'],
  schema: z.object({ name: z.string().min(2).max(120), status: z.boolean().default(true) }),
});
