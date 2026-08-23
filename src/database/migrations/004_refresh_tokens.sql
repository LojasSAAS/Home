-- ============================================================================
-- 004_refresh_tokens.sql
-- Suporte a refresh token: o JWT de acesso passa a ter vida curta (15min),
-- e esta tabela guarda um token opaco de vida longa (hash, nunca o valor cru)
-- que pode ser revogado — logout, troca de senha, funcionário desativado, etc.
-- ============================================================================

CREATE TYPE token_subject_type AS ENUM ('CUSTOMER', 'STORE_STAFF');

CREATE TABLE refresh_tokens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id        UUID NOT NULL, -- users.id ou store_staff.id, conforme subject_type
  subject_type      token_subject_type NOT NULL,
  tenant_id         UUID REFERENCES stores(id) ON DELETE CASCADE, -- só para STORE_STAFF
  token_hash        TEXT NOT NULL UNIQUE, -- SHA-256 do token opaco — nunca o valor cru
  expires_at        TIMESTAMPTZ NOT NULL,
  revoked_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_subject ON refresh_tokens (subject_id, subject_type);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens (token_hash);
-- Consulta comum: token ainda válido (não expirado, não revogado)
CREATE INDEX idx_refresh_tokens_active ON refresh_tokens (token_hash) WHERE revoked_at IS NULL;
