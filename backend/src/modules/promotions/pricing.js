// Fragmento SQL: melhor promoção ativa por produto (alias de products = p). Sem empilhar promoções:
// vale o menor preço resultante (regra de combinação ainda pendente no Doc. 01 §9 — ver README).
const PROMO_EXPR = `CASE pr.discount_type WHEN 'percentual' THEN round(p.sale_price * (1 - pr.discount_value / 100), 2)
                         ELSE p.sale_price - pr.discount_value END`;
const PROMO_JOIN = `LEFT JOIN LATERAL (
  SELECT pr.id AS promo_id, pr.name AS promo_name, ${PROMO_EXPR} AS promo_price
    FROM promotion_products pp JOIN promotions pr ON pr.id = pp.promotion_id
   WHERE pp.product_id = p.id AND pr.status AND now() BETWEEN pr.start_at AND pr.end_at AND (${PROMO_EXPR}) > 0
   ORDER BY promo_price ASC LIMIT 1) promo ON TRUE`;
module.exports = { PROMO_JOIN };
