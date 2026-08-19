-- ============================================================================
-- 002_store_staff.sql
-- Login do lado do lojista: quem gerencia catálogo/estoque/pedidos da loja.
-- Separado de `users` (que são os clientes finais do app).
-- ============================================================================

CREATE TYPE staff_role AS ENUM ('OWNER', 'MANAGER', 'STAFF');

CREATE TABLE store_staff (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name                VARCHAR(150) NOT NULL,
  email               VARCHAR(150) NOT NULL,
  password_hash       TEXT NOT NULL,
  role                staff_role NOT NULL DEFAULT 'STAFF',
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- E-mail só precisa ser único DENTRO da mesma loja (mesma pessoa pode
-- trabalhar em duas lojas diferentes do SaaS com o mesmo e-mail).
CREATE UNIQUE INDEX idx_store_staff_tenant_email ON store_staff (tenant_id, email);
CREATE INDEX idx_store_staff_tenant_id ON store_staff (tenant_id);

CREATE TRIGGER set_updated_at_store_staff BEFORE UPDATE ON store_staff
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
