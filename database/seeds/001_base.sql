-- Seed base (idempotente): funções, permissões, regiões, configurações e categorias iniciais.
INSERT INTO permissions (code, name, description) VALUES
 ('products.manage',   'Gerenciar produtos',      'Cadastrar, editar e desativar produtos, categorias, fabricantes e compatibilidade'),
 ('inventory.manage',  'Gerenciar estoque',       'Registrar entradas, saídas e ajustes de estoque'),
 ('orders.view',       'Visualizar pedidos',      'Consultar pedidos, clientes e notificações'),
 ('orders.update',     'Alterar pedidos',         'Confirmar, cancelar e atualizar status, entrega e pagamento'),
 ('customers.view',    'Consultar clientes',      'Consultar dados dos clientes'),
 ('promotions.manage', 'Gerenciar promoções',     'Criar e editar promoções e descontos'),
 ('reviews.moderate',  'Moderar avaliações',      'Publicar, ocultar e moderar avaliações'),
 ('reports.view',      'Visualizar relatórios',   'Acessar relatórios comerciais e financeiros'),
 ('settings.manage',   'Gerenciar configurações', 'Alterar configurações da loja e regiões de entrega'),
 ('audit.view',        'Consultar auditoria',     'Consultar o histórico de atividades'),
 ('users.manage',      'Gerenciar usuários',      'Criar usuários, bloquear contas e definir permissões')
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles (name, description) VALUES
 ('Administrador', 'Acesso completo ao sistema'),
 ('Gerente',       'Gerencia produtos, estoque, pedidos, promoções e relatórios'),
 ('Estoquista',    'Gerencia produtos e estoque'),
 ('Atendente',     'Consulta pedidos e atualiza as etapas de atendimento e entrega')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE (r.name = 'Administrador')
   OR (r.name = 'Gerente'    AND p.code IN ('products.manage','inventory.manage','orders.view','orders.update','customers.view','promotions.manage','reviews.moderate','reports.view'))
   OR (r.name = 'Estoquista' AND p.code IN ('products.manage','inventory.manage'))
   OR (r.name = 'Atendente'  AND p.code IN ('orders.view','orders.update','customers.view'))
ON CONFLICT DO NOTHING;

INSERT INTO delivery_regions (city, state) VALUES ('Crato','CE'), ('Juazeiro do Norte','CE')
ON CONFLICT (city, state) DO NOTHING;

INSERT INTO store_settings (setting_key, setting_value) VALUES
 ('store_name',            'Moto Peças Sistem'),
 ('store_phone',           '5588999999999'),
 ('store_email',           'contato@motopecassistem.com.br'),
 ('store_address',         'Crato — CE'),
 ('store_latitude',        '-7.2339'),
 ('store_longitude',       '-39.4098'),
 ('contact_info',          'Atendimento pelo WhatsApp em horário comercial.'),
 ('business_days',         '[1,2,3,4,5,6]'),
 ('business_hours',        '{"open":"08:00","close":"18:00"}'),
 ('reservation_minutes',   '30'),
 ('freight_base',          '5.00'),
 ('freight_per_km',        '1.50'),
 ('freight_min',           '8.00'),
 ('accept_pickup',         'true'),
 ('accept_delivery',       'true'),
 ('reviews_require_approval','false'),
 ('payment_methods',       '["pix","dinheiro","cartao_credito","cartao_debito"]')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO categories (name, description)
SELECT v.name, v.description FROM (VALUES
 ('Motor',        'Peças de motor: filtros, velas, pistões e juntas'),
 ('Freios',       'Pastilhas, discos, sapatas e fluidos'),
 ('Transmissão',  'Kits de relação, correntes, coroas e pinhões'),
 ('Elétrica',     'Baterias, velas, lâmpadas, relés e cabos'),
 ('Suspensão',    'Amortecedores, retentores e bengalas'),
 ('Acessórios',   'Capacetes, retrovisores, manoplas e proteções')
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.name = v.name AND c.parent_id IS NULL);
