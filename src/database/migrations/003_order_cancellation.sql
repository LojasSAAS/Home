-- ============================================================================
-- 003_order_cancellation.sql
-- Campo para registrar o motivo quando um pedido é cancelado (pelo lojista
-- ou, futuramente, pelo cliente) — importante para métricas e para o chat
-- mostrar contexto ao cliente.
-- ============================================================================

ALTER TABLE orders ADD COLUMN cancellation_reason TEXT;
