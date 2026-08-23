import { query } from '@/config/database';
import { generateRefreshToken, hashRefreshToken } from '@/utils/refreshToken';

const REFRESH_TOKEN_TTL_DAYS = 30;

interface IssueParams {
  subjectId: string;
  subjectType: 'CUSTOMER' | 'STORE_STAFF';
  tenantId?: string; // só para STORE_STAFF
}

export const RefreshTokenRepository = {
  async issue(params: IssueParams): Promise<string> {
    const token = generateRefreshToken();
    const tokenHash = hashRefreshToken(token);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await query(
      `INSERT INTO refresh_tokens (subject_id, subject_type, tenant_id, token_hash, expires_at)
       VALUES ($1, $2::token_subject_type, $3, $4, $5)`,
      [params.subjectId, params.subjectType, params.tenantId ?? null, tokenHash, expiresAt],
    );

    return token;
  },

  async findValid(rawToken: string) {
    const tokenHash = hashRefreshToken(rawToken);
    const result = await query(
      `SELECT id, subject_id, subject_type, tenant_id, expires_at
         FROM refresh_tokens
        WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
        LIMIT 1`,
      [tokenHash],
    );
    return result.rows[0] ?? null;
  },

  async revokeById(id: string) {
    await query(`UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1`, [id]);
  },

  async revokeByRawToken(rawToken: string) {
    const tokenHash = hashRefreshToken(rawToken);
    await query(`UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1`, [tokenHash]);
  },

  async revokeAllForSubject(subjectId: string, subjectType: 'CUSTOMER' | 'STORE_STAFF') {
    await query(
      `UPDATE refresh_tokens
          SET revoked_at = now()
        WHERE subject_id = $1 AND subject_type = $2::token_subject_type AND revoked_at IS NULL`,
      [subjectId, subjectType],
    );
  },
};
