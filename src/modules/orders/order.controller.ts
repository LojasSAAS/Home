import { Request, Response, NextFunction } from 'express';
import { query } from '@/config/database';
import { createOrderSchema } from './order.schema';
import { createOrder } from './order.service';
import { AppError } from '@/middlewares/error.middleware';
import { Store } from '@/types';

/**
 * POST /orders
 * Body: { tenant_slug, customer_id, fulfillment_type, items[], delivery_address?, notes? }
 *
 * Fluxo: valida payload -> resolve tenant pelo slug -> delega a criação
 * (com lock de estoque em transação) ao order.service.
 */
export async function postOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido', details: parsed.error.flatten() });
    }

    const input = parsed.data;

    const tenantResult = await query<Store>(
      `SELECT id, name, slug, category, accepts_delivery, accepts_pickup,
              accepts_in_store, delivery_radius_km, base_delivery_fee, settings, is_active
         FROM stores WHERE slug = $1 AND is_active = TRUE LIMIT 1`,
      [input.tenant_slug],
    );

    if (tenantResult.rowCount === 0) {
      throw new AppError('Loja não encontrada ou inativa', 404);
    }

    // req.userId é setado pelo middleware requireCustomerAuth — nunca confiamos
    // em um customer_id vindo do corpo da requisição.
    const order = await createOrder(input, tenantResult.rows[0], req.userId!);

    return res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
}
