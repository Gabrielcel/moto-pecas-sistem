const router = require('express').Router();
const { z } = require('zod');
const crud = require('../../utils/simpleCrud');

const year = z.number().int().min(1950).max(2100).nullish();
router.use('/brands', crud({
  table: 'motorcycle_brands', entity: 'marca_moto', permission: 'products.manage', cols: ['name', 'status'], orderBy: 't.name',
  usedBy: ['SELECT 1 FROM motorcycle_models WHERE brand_id=$1 LIMIT 1'],
  schema: z.object({ name: z.string().min(2).max(100), status: z.boolean().default(true) }),
}));
router.use('/models', crud({
  table: 'motorcycle_models', entity: 'modelo_moto', permission: 'products.manage',
  cols: ['brand_id', 'name', 'year_start', 'year_end', 'engine_displacement', 'status'], orderBy: 'b.name, t.name',
  select: 'SELECT t.*, b.name AS brand_name FROM motorcycle_models t JOIN motorcycle_brands b ON b.id = t.brand_id',
  filters: { brand_id: 't.brand_id' },
  usedBy: ['SELECT 1 FROM product_compatibilities WHERE motorcycle_model_id=$1 LIMIT 1'],
  schema: z.object({ brand_id: z.number().int().positive(), name: z.string().min(1).max(120), year_start: year, year_end: year,
    engine_displacement: z.number().int().min(0).max(3000).nullish(), status: z.boolean().default(true) }),
}));
module.exports = router;
