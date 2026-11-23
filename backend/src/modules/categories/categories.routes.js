const { z } = require('zod');
module.exports = require('../../utils/simpleCrud')({
  table: 'categories', entity: 'categoria', permission: 'products.manage', cols: ['name', 'description', 'parent_id', 'status'], orderBy: 't.name',
  select: 'SELECT t.*, p.name AS parent_name FROM categories t LEFT JOIN categories p ON p.id = t.parent_id',
  usedBy: ['SELECT 1 FROM products WHERE category_id=$1 LIMIT 1', 'SELECT 1 FROM categories WHERE parent_id=$1 LIMIT 1'],
  schema: z.object({ name: z.string().min(2).max(120), description: z.string().max(500).nullish(), parent_id: z.number().int().positive().nullish(), status: z.boolean().default(true) }),
});
