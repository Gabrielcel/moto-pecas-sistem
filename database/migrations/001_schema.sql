-- =====================================================================
-- Moto Peças Sistem — Schema PostgreSQL (Documento 02 — Modelagem)
-- Migração 001: estrutura completa das tabelas, restrições e gatilhos.
-- Política de datas: TIMESTAMPTZ (armazenado em UTC; exibição America/Fortaleza).
-- Valores monetários: NUMERIC(12,2). Chaves: BIGINT GENERATED ALWAYS AS IDENTITY.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 3.1 Usuários e permissões
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name           VARCHAR(150) NOT NULL,
  email          VARCHAR(180) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  status         VARCHAR(20)  NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','bloqueado')),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  last_login_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_users_email ON users (lower(email));
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE roles (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        VARCHAR(80) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Extensão: "code" é o identificador técnico usado pelo backend (ex.: products.manage).
CREATE TABLE permissions (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        VARCHAR(60)  NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE user_roles (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE role_permissions (
  role_id       BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Extensão (Doc. 03 §7.3): sessões administrativas revogáveis, guardadas como hash.
CREATE TABLE admin_sessions (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash          VARCHAR(255) NOT NULL UNIQUE,
  csrf_hash           VARCHAR(255),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ NOT NULL,
  absolute_expires_at TIMESTAMPTZ NOT NULL,
  ip_address          INET,
  user_agent          TEXT
);
CREATE INDEX idx_admin_sessions_user ON admin_sessions (user_id);

-- Extensão (Doc. 03 §7.5): recuperação de senha com token de validade limitada.
CREATE TABLE password_reset_tokens (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3.2 Clientes
-- ---------------------------------------------------------------------
CREATE TABLE customers (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  email      VARCHAR(180),
  phone      VARCHAR(30)  NOT NULL,
  cpf        VARCHAR(14),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE customer_addresses (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id  BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  postal_code  VARCHAR(10),
  street       VARCHAR(180) NOT NULL,
  number       VARCHAR(20),
  complement   VARCHAR(120),
  neighborhood VARCHAR(100),
  city         VARCHAR(100) NOT NULL,
  state        CHAR(2) NOT NULL,
  reference    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3.3 Categorias e fabricantes
-- ---------------------------------------------------------------------
CREATE TABLE categories (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  description TEXT,
  parent_id   BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  status      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE TABLE brands (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       VARCHAR(120) NOT NULL UNIQUE,
  status     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3.4 Produtos
-- ---------------------------------------------------------------------
CREATE TABLE products (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id   BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  brand_id      BIGINT REFERENCES brands(id) ON DELETE SET NULL,
  name          VARCHAR(180) NOT NULL,
  reference     VARCHAR(100),
  description   TEXT,
  sale_price    NUMERIC(12,2) NOT NULL CHECK (sale_price >= 0),
  purchase_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (purchase_cost >= 0),
  status        VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
  is_featured   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status <> 'ativo' OR sale_price > 0)
);
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE product_images (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id    BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url     TEXT NOT NULL,
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3.5 Compatibilidade com motocicletas
-- ---------------------------------------------------------------------
CREATE TABLE motorcycle_brands (
  id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name   VARCHAR(100) NOT NULL UNIQUE,
  status BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE motorcycle_models (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  brand_id            BIGINT NOT NULL REFERENCES motorcycle_brands(id) ON DELETE RESTRICT,
  name                VARCHAR(120) NOT NULL,
  year_start          SMALLINT,
  year_end            SMALLINT,
  engine_displacement INTEGER,
  status              BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (year_end IS NULL OR year_start IS NULL OR year_end >= year_start)
);

CREATE TABLE product_compatibilities (
  product_id          BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  motorcycle_model_id BIGINT NOT NULL REFERENCES motorcycle_models(id) ON DELETE CASCADE,
  notes               TEXT,
  PRIMARY KEY (product_id, motorcycle_model_id)
);

-- ---------------------------------------------------------------------
-- 3.6 Estoque
-- ---------------------------------------------------------------------
CREATE TABLE inventory (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id        BIGINT NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  quantity          INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  minimum_quantity  INTEGER NOT NULL DEFAULT 0 CHECK (minimum_quantity >= 0),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (reserved_quantity <= quantity)   -- reservado nunca ultrapassa o físico
);
CREATE TRIGGER trg_inventory_updated BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- inventory_movements.order_id é ligada a orders mais abaixo (FK adicionada após a criação de orders)
CREATE TABLE inventory_movements (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id    BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  user_id       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  order_id      BIGINT,
  movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN
                  ('entrada','saida','reserva','liberacao_reserva','ajuste_positivo','ajuste_negativo')),
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3.7 Pedidos
-- ---------------------------------------------------------------------
CREATE SEQUENCE order_code_seq START 1;

CREATE TABLE orders (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_code           VARCHAR(30) NOT NULL UNIQUE,
  tracking_token_hash  VARCHAR(255) NOT NULL,
  customer_id          BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  status               VARCHAR(30) NOT NULL DEFAULT 'pedido_recebido' CHECK (status IN
                         ('pedido_recebido','pedido_confirmado','preparando_pedido',
                          'saiu_para_entrega','pedido_entregue','pedido_cancelado')),
  subtotal             NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  discount_total       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  delivery_fee         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  total                NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  payment_status       VARCHAR(30) NOT NULL DEFAULT 'pendente' CHECK (payment_status IN ('pendente','pago','cancelado')),
  receiving_method     VARCHAR(20) NOT NULL CHECK (receiving_method IN ('entrega','retirada')),
  whatsapp_consent     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Extensões necessárias às regras do Documento 00 (reserva, frete estimado x final, pagamento na entrega):
  delivery_fee_estimate   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (delivery_fee_estimate >= 0),
  payment_method_preferred VARCHAR(30),
  notes                TEXT,
  reservation_expires_at TIMESTAMPTZ,
  confirmed_at         TIMESTAMPTZ,
  delivered_at         TIMESTAMPTZ,
  cancelled_at         TIMESTAMPTZ,
  cancel_reason        TEXT
);
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE inventory_movements
  ADD CONSTRAINT fk_movements_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

CREATE TABLE order_items (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id          BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name      VARCHAR(180) NOT NULL,
  product_reference VARCHAR(100),
  quantity          INTEGER NOT NULL CHECK (quantity > 0),
  unit_price        NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  unit_cost         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  discount_amount   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  total             NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  -- Extensão: preço de tabela no momento da compra (para exibir "de/por" no histórico)
  list_price        NUMERIC(12,2)
);

CREATE TABLE order_status_history (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id        BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id         BIGINT REFERENCES users(id) ON DELETE SET NULL,
  previous_status VARCHAR(30),
  new_status      VARCHAR(30) NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3.8 Pagamentos (pagamento na entrega — sem gateway na versão inicial)
-- ---------------------------------------------------------------------
CREATE TABLE payments (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id              BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method        VARCHAR(30) NOT NULL CHECK (payment_method IN ('pix','dinheiro','cartao_credito','cartao_debito')),
  amount                NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  status                VARCHAR(30) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','falhou','cancelado')),
  transaction_reference VARCHAR(180),
  paid_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id               BIGINT REFERENCES users(id) ON DELETE SET NULL   -- extensão: quem registrou
);

-- ---------------------------------------------------------------------
-- 3.9 Entregas e regiões atendidas
-- ---------------------------------------------------------------------
CREATE TABLE delivery_regions (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  city       VARCHAR(100) NOT NULL,
  state      CHAR(2) NOT NULL,
  status     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (city, state)
);

CREATE TABLE order_deliveries (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id           BIGINT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  delivery_region_id BIGINT REFERENCES delivery_regions(id) ON DELETE SET NULL,
  postal_code        VARCHAR(10),
  street             VARCHAR(180) NOT NULL,
  number             VARCHAR(20),
  complement         VARCHAR(120),
  neighborhood       VARCHAR(100),
  city               VARCHAR(100) NOT NULL,
  state              CHAR(2) NOT NULL,
  reference          TEXT,
  latitude           NUMERIC(10,7),
  longitude          NUMERIC(10,7),
  distance_km        NUMERIC(10,2),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Extensões: previsão de entrega e modalidade de transporte (próprio, Uber...)
  estimated_delivery_at TIMESTAMPTZ,
  carrier            VARCHAR(30) NOT NULL DEFAULT 'proprio' CHECK (carrier IN ('proprio','uber','outro'))
);

CREATE TABLE delivery_status_history (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_delivery_id BIGINT NOT NULL REFERENCES order_deliveries(id) ON DELETE CASCADE,
  user_id           BIGINT REFERENCES users(id) ON DELETE SET NULL,
  status            VARCHAR(30) NOT NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3.10 Promoções
-- ---------------------------------------------------------------------
CREATE TABLE promotions (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name           VARCHAR(150) NOT NULL,
  description    TEXT,
  discount_type  VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentual','fixo')),
  discount_value NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
  start_at       TIMESTAMPTZ NOT NULL,
  end_at         TIMESTAMPTZ NOT NULL,
  status         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at),
  CHECK (discount_type <> 'percentual' OR discount_value < 100)
);

CREATE TABLE promotion_products (
  promotion_id BIGINT NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  product_id   BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, product_id)
);

-- ---------------------------------------------------------------------
-- 3.11 Avaliações
-- ---------------------------------------------------------------------
CREATE TABLE reviews (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id    BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_item_id BIGINT NOT NULL UNIQUE REFERENCES order_items(id) ON DELETE CASCADE,
  customer_id   BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  status        VARCHAR(20) NOT NULL DEFAULT 'publicada' CHECK (status IN ('pendente','publicada','oculta')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_reviews_updated BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 3.12 Notificações / WhatsApp
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id           BIGINT REFERENCES orders(id) ON DELETE CASCADE,
  customer_id        BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  channel            VARCHAR(30) NOT NULL DEFAULT 'whatsapp',
  notification_type  VARCHAR(50) NOT NULL,
  message            TEXT NOT NULL,
  status             VARCHAR(30) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviada','falhou','nao_configurado')),
  external_reference VARCHAR(180),
  sent_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notification_attempts (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  notification_id BIGINT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  attempt_number  INTEGER NOT NULL,
  result          VARCHAR(30) NOT NULL,
  error_message   TEXT,
  attempted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3.13 Configurações da loja
-- ---------------------------------------------------------------------
CREATE TABLE store_settings (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  setting_key   VARCHAR(120) NOT NULL UNIQUE,
  setting_value TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    BIGINT REFERENCES users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
-- 3.14 Auditoria (imutável: UPDATE/DELETE bloqueados por gatilho)
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80),
  entity_id   BIGINT,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION audit_logs_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs é imutável: % não permitido', TG_OP USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_no_change
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
