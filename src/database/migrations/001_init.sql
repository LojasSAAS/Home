-- ============================================================================
-- 001_init.sql
-- SaaS Super-App para Varejo Local — Schema inicial (Multi-Tenant)
-- Convenção: toda tabela "tenant-aware" tem tenant_id e índice dedicado.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
CREATE TYPE store_category AS ENUM ('BURGER', 'PET', 'CLOTHING', 'MARKET', 'OTHER');
CREATE TYPE fulfillment_type AS ENUM ('DELIVERY', 'PICKUP', 'IN_STORE');
CREATE TYPE order_status AS ENUM (
  'PENDING', 'ACCEPTED', 'PREPARING', 'OUT_FOR_DELIVERY',
  'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED'
);
CREATE TYPE payment_status AS ENUM ('PENDING_EXTERNAL', 'PAID_AT_STORE', 'PAID_EXTERNAL_CONFIRMED');
CREATE TYPE sender_type AS ENUM ('CUSTOMER', 'STORE');

-- ----------------------------------------------------------------------------
-- STORES (Tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE stores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(150) NOT NULL,
  slug                VARCHAR(150) NOT NULL UNIQUE,
  category            store_category NOT NULL DEFAULT 'OTHER',
  accepts_delivery    BOOLEAN NOT NULL DEFAULT TRUE,
  accepts_pickup      BOOLEAN NOT NULL DEFAULT TRUE,
  accepts_in_store    BOOLEAN NOT NULL DEFAULT TRUE,
  delivery_radius_km  NUMERIC(5,2) DEFAULT 5.00,
  base_delivery_fee   NUMERIC(10,2) DEFAULT 0.00,
  settings            JSONB NOT NULL DEFAULT '{}'::jsonb, -- horários, PIX/loja, etc.
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stores_slug ON stores (slug);
CREATE INDEX idx_stores_category ON stores (category);

-- ----------------------------------------------------------------------------
-- USERS (clientes finais da plataforma — não é usuário da loja/admin)
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(150) NOT NULL,
  email               VARCHAR(150) NOT NULL UNIQUE,
  cpf                 VARCHAR(11) UNIQUE, -- armazenar apenas dígitos
  password_hash       TEXT NOT NULL,
  phone               VARCHAR(20),
  lgpd_accepted       BOOLEAN NOT NULL DEFAULT FALSE,
  terms_accepted_at   TIMESTAMPTZ,
  terms_version       VARCHAR(20), -- rastreia qual versão dos termos foi aceita
  deletion_requested_at TIMESTAMPTZ, -- suporte a "direito ao esquecimento" (LGPD)
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users (email);

-- ----------------------------------------------------------------------------
-- PRODUCTS
-- ----------------------------------------------------------------------------
CREATE TABLE products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name                VARCHAR(200) NOT NULL,
  description         TEXT,
  price               NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  barcode             VARCHAR(64), -- código de barras (EAN/UPC) — usado no fluxo IN_STORE
  sku                 VARCHAR(64),
  current_stock       INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  safety_stock        INTEGER NOT NULL DEFAULT 0 CHECK (safety_stock >= 0), -- margem de segurança
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb, -- ex: {"raca_pet": "cao"}, {"tamanho": "M"}
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices obrigatórios multi-tenant + busca por barcode (fluxo IN_STORE precisa ser rápido)
CREATE INDEX idx_products_tenant_id ON products (tenant_id);
CREATE UNIQUE INDEX idx_products_tenant_barcode ON products (tenant_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_products_tenant_active ON products (tenant_id, is_active);

-- ----------------------------------------------------------------------------
-- ORDERS
-- ----------------------------------------------------------------------------
CREATE TABLE orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  customer_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  fulfillment_type    fulfillment_type NOT NULL,
  status              order_status NOT NULL DEFAULT 'PENDING',
  payment_status      payment_status NOT NULL DEFAULT 'PENDING_EXTERNAL',
  total_amount        NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  delivery_fee        NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  delivery_address    JSONB, -- só preenchido quando fulfillment_type = DELIVERY
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_tenant_id ON orders (tenant_id);
CREATE INDEX idx_orders_customer_id ON orders (customer_id);
CREATE INDEX idx_orders_tenant_status ON orders (tenant_id, status);
CREATE INDEX idx_orders_tenant_created_at ON orders (tenant_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- ORDER_ITEMS
-- ----------------------------------------------------------------------------
CREATE TABLE order_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity            INTEGER NOT NULL CHECK (quantity > 0),
  unit_price          NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0), -- snapshot do preço no momento da compra
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order_id ON order_items (order_id);
CREATE INDEX idx_order_items_product_id ON order_items (product_id);

-- ----------------------------------------------------------------------------
-- MESSAGES (Chat vinculado ao pedido)
-- ----------------------------------------------------------------------------
CREATE TABLE messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_type         sender_type NOT NULL,
  sender_id           UUID NOT NULL, -- user_id (CUSTOMER) ou store_staff_id (STORE)
  message_body        TEXT NOT NULL,
  read_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_tenant_id ON messages (tenant_id);
CREATE INDEX idx_messages_order_id ON messages (order_id, created_at ASC);

-- ----------------------------------------------------------------------------
-- Trigger genérico para updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_stores BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_users BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_products BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_orders BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
