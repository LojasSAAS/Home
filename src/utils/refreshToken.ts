import crypto from 'crypto';

/**
 * Gera um token opaco de alta entropia (256 bits) para uso como refresh token.
 * Diferente do access token (JWT), este não carrega dados — é só uma chave
 * aleatória que referencia uma linha em refresh_tokens.
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * SHA-256 do token — o que guardamos no banco. Nunca armazenamos o valor cru:
 * se o banco vazar, os tokens não são diretamente utilizáveis.
 * (bcrypt não é necessário aqui porque a entrada já tem entropia alta o
 * suficiente — diferente de senhas escolhidas por humanos.)
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
