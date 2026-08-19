import { Request, Response, NextFunction } from 'express';
import { query } from '@/config/database';
import { Store } from '@/types';

/**
 * Resolve a loja (tenant) a partir do :slug na rota e anexa em req.tenant.
 * Toda rota que opera sobre dados de uma loja específica deve passar por aqui
 * ANTES de qualquer query em tabelas com tenant_id — evita vazamento entre tenants.
 */
export async function resolveTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const { slug } = req.params;
    if (!slug) {
      return res.status(400).json({ error: 'slug da loja é obrigatório' });
    }

    const result = await query<Store>(
      `SELECT id, name, slug, category, accepts_delivery, accepts_pickup,
              accepts_in_store, delivery_radius_km, base_delivery_fee,
              settings, is_active
         FROM stores
        WHERE slug = $1 AND is_active = TRUE
        LIMIT 1`,
      [slug],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Loja não encontrada ou inativa' });
    }

    req.tenant = result.rows[0];
    next();
  } catch (err) {
    next(err);
  }
}
