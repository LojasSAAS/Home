import { Request, Response, NextFunction } from 'express';
import { query } from '@/config/database';
import { createOrderSchema, updateOrderStatusSchema, listOrdersQuerySchema } from './order.schema';
import { createOrder, updateOrderStatus } from './order.service';
import { OrderRepository } from './order.repository';
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

/**
 * GET /stores/:slug/orders?status=PENDING&limit=20&offset=0
 * Painel do lojista: lista pedidos da loja, com filtro opcional por status.
 */
export async function getOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const parsed = listOrdersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Query inválida', details: parsed.error.flatten() });
    }

    const orders = await OrderRepository.findByTenant(tenant.id, parsed.data);
    return res.status(200).json({ orders });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /stores/:slug/orders/:id
 * Detalhe do pedido com itens (nome do produto incluso, útil pro painel).
 */
export async function getOrderById(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const { id } = req.params;

    const order = await OrderRepository.findByIdWithItems(id, tenant.id);
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado nesta loja' });
    }

    return res.status(200).json(order);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /stores/:slug/orders/:id/status
 * Ação central do painel do lojista: aceitar, preparar, marcar como saiu
 * para entrega/pronto para retirada, concluir ou cancelar.
 */
export async function patchOrderStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const { id } = req.params;

    const parsed = updateOrderStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido', details: parsed.error.flatten() });
    }

    const order = await updateOrderStatus(tenant.id, id, parsed.data.status, parsed.data.reason);
    return res.status(200).json({ order });
  } catch (err) {
    next(err);
  }
}
