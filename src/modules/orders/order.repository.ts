import { PoolClient } from 'pg';
import { query } from '@/config/database';

interface CreateOrderParams {
  tenant_id: string;
  customer_id: string;
  fulfillment_type: string;
  payment_status: string;
  total_amount: number;
  delivery_fee: number;
  delivery_address: Record<string, unknown> | null;
  notes: string | null;
  items: { product_id: string; quantity: number; unit_price: number }[];
}

export const OrderRepository = {
  async create(params: CreateOrderParams, client: PoolClient) {
    const orderResult = await client.query(
      `INSERT INTO orders
         (tenant_id, customer_id, fulfillment_type, status, payment_status,
          total_amount, delivery_fee, delivery_address, notes)
       VALUES ($1, $2, $3, 'PENDING', $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        params.tenant_id,
        params.customer_id,
        params.fulfillment_type,
        params.payment_status,
        params.total_amount,
        params.delivery_fee,
        params.delivery_address ? JSON.stringify(params.delivery_address) : null,
        params.notes,
      ],
    );

    const order = orderResult.rows[0];

    // Insert em lote dos itens (query parametrizada, sem concatenação de string)
    const values: unknown[] = [];
    const placeholders = params.items
      .map((item, idx) => {
        const base = idx * 4;
        values.push(order.id, item.product_id, item.quantity, item.unit_price);
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
      })
      .join(', ');

    await client.query(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
       VALUES ${placeholders}`,
      values,
    );

    return order;
  },

  async findById(orderId: string, tenantId: string) {
    const result = await query(
      `SELECT * FROM orders WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [orderId, tenantId],
    );
    return result.rows[0] ?? null;
  },

  async updateStatus(orderId: string, tenantId: string, status: string) {
    const result = await query(
      `UPDATE orders SET status = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [status, orderId, tenantId],
    );
    return result.rows[0] ?? null;
  },

  async findByTenant(tenantId: string, filters: { status?: string; limit: number; offset: number }) {
    if (filters.status) {
      const result = await query(
        `SELECT * FROM orders
          WHERE tenant_id = $1 AND status = $2
          ORDER BY created_at DESC
          LIMIT $3 OFFSET $4`,
        [tenantId, filters.status, filters.limit, filters.offset],
      );
      return result.rows;
    }

    const result = await query(
      `SELECT * FROM orders
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [tenantId, filters.limit, filters.offset],
    );
    return result.rows;
  },

  async findByIdWithItems(orderId: string, tenantId: string) {
    const orderResult = await query(
      `SELECT * FROM orders WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [orderId, tenantId],
    );
    const order = orderResult.rows[0];
    if (!order) return null;

    const itemsResult = await query(
      `SELECT oi.id, oi.product_id, oi.quantity, oi.unit_price, p.name AS product_name
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = $1
        ORDER BY oi.created_at ASC`,
      [orderId],
    );

    return { ...order, items: itemsResult.rows };
  },
};
