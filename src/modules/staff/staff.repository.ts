import { query } from '@/config/database';

export const StaffRepository = {
  async findByTenant(tenantId: string) {
    const result = await query(
      `SELECT id, tenant_id, name, email, role, is_active, created_at
         FROM store_staff
        WHERE tenant_id = $1
        ORDER BY created_at ASC`,
      [tenantId],
    );
    return result.rows;
  },

  async findByEmailAndTenant(tenantId: string, email: string) {
    const result = await query(
      `SELECT id FROM store_staff WHERE tenant_id = $1 AND email = $2 LIMIT 1`,
      [tenantId, email],
    );
    return result.rows[0] ?? null;
  },

  async create(params: { tenantId: string; name: string; email: string; passwordHash: string; role: string }) {
    const result = await query(
      `INSERT INTO store_staff (tenant_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5::staff_role)
       RETURNING id, tenant_id, name, email, role, is_active, created_at`,
      [params.tenantId, params.name, params.email, params.passwordHash, params.role],
    );
    return result.rows[0];
  },

  async findById(tenantId: string, staffId: string) {
    const result = await query(
      `SELECT id, tenant_id, name, email, role, is_active
         FROM store_staff
        WHERE id = $1 AND tenant_id = $2
        LIMIT 1`,
      [staffId, tenantId],
    );
    return result.rows[0] ?? null;
  },

  async setActive(tenantId: string, staffId: string, isActive: boolean) {
    const result = await query(
      `UPDATE store_staff SET is_active = $1
        WHERE id = $2 AND tenant_id = $3
        RETURNING id, tenant_id, name, email, role, is_active`,
      [isActive, staffId, tenantId],
    );
    return result.rows[0] ?? null;
  },
};
