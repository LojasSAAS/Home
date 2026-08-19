import { query } from '@/config/database';

export const AuthRepository = {
  async findUserByEmail(email: string) {
    const result = await query(
      `SELECT id, name, email, password_hash, is_active FROM users WHERE email = $1 LIMIT 1`,
      [email],
    );
    return result.rows[0] ?? null;
  },

  async createUser(params: { name: string; email: string; passwordHash: string; cpf?: string }) {
    const result = await query(
      `INSERT INTO users (name, email, password_hash, cpf)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, created_at`,
      [params.name, params.email, params.passwordHash, params.cpf ?? null],
    );
    return result.rows[0];
  },

  async findStaffByEmailAndTenant(tenantId: string, email: string) {
    const result = await query(
      `SELECT id, tenant_id, name, email, password_hash, role, is_active
         FROM store_staff
        WHERE tenant_id = $1 AND email = $2
        LIMIT 1`,
      [tenantId, email],
    );
    return result.rows[0] ?? null;
  },
};
