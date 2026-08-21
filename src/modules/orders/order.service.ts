import { withTransaction } from '@/config/database';
import { AppError } from '@/middlewares/error.middleware';
import { ProductRepository } from '@/modules/products/product.repository';
import { CreateOrderInput } from './order.schema';
import { OrderRepository } from './order.repository';
import { Store } from '@/types';
import { emitOrderStatusUpdate } from '@/modules/chat/chat.gateway';

/**
 * Cria um pedido de forma orquestrada.
 *
 * REGRA DE OURO: este SaaS NUNCA processa pagamento. O pedido nasce sempre
 * com payment_status = 'PENDING_EXTERNAL' (ou 'PAID_AT_STORE' para IN_STORE),
 * e a cobrança acontece por fora (na loja, PIX próprio do lojista, etc).
 */
export async function createOrder(input: CreateOrderInput, tenant: Store, customerId: string) {
  if (!tenantSupportsFulfillment(tenant, input.fulfillment_type)) {
    throw new AppError(
      `Esta loja não aceita o tipo de atendimento '${input.fulfillment_type}'`,
      422,
    );
  }

  return withTransaction(async (client) => {
    const productIds = input.items.map((i) => i.product_id);

    // Lock pessimista (FOR UPDATE) nas linhas dos produtos evita que dois
    // pedidos concorrentes vendam a mesma unidade além do estoque disponível.
    const products = await ProductRepository.findByIdsForUpdate(tenant.id, productIds, client);

    if (products.length !== productIds.length) {
      throw new AppError('Um ou mais produtos não existem ou não pertencem a esta loja', 422);
    }

    let totalAmount = 0;
    const itemsToInsert: { product_id: string; quantity: number; unit_price: number }[] = [];

    for (const item of input.items) {
      const product = products.find((p) => p.id === item.product_id)!;

      if (!product.is_active) {
        throw new AppError(`Produto '${product.name}' não está mais disponível`, 422);
      }

      // Controle de estoque pragmático: respeita a margem de segurança configurada.
      const availableStock = product.current_stock - product.safety_stock;
      if (availableStock < item.quantity) {
        throw new AppError(
          `Estoque insuficiente para '${product.name}' (disponível: ${Math.max(availableStock, 0)})`,
          409,
        );
      }

      totalAmount += Number(product.price) * item.quantity;
      itemsToInsert.push({
        product_id: product.id,
        quantity: item.quantity,
        unit_price: Number(product.price),
      });

      await ProductRepository.decrementStock(product.id, item.quantity, client);
    }

    const deliveryFee = input.fulfillment_type === 'DELIVERY' ? Number(tenant.base_delivery_fee) : 0;
    totalAmount += deliveryFee;

    // IN_STORE normalmente significa "paga na hora, no caixa físico".
    const paymentStatus = input.fulfillment_type === 'IN_STORE' ? 'PAID_AT_STORE' : 'PENDING_EXTERNAL';

    const order = await OrderRepository.create(
      {
        tenant_id: tenant.id,
        customer_id: customerId,
        fulfillment_type: input.fulfillment_type,
        payment_status: paymentStatus,
        total_amount: totalAmount,
        delivery_fee: deliveryFee,
        delivery_address: input.delivery_address ?? null,
        notes: input.notes ?? null,
        items: itemsToInsert,
      },
      client,
    );

    return order;
  });
}

function tenantSupportsFulfillment(tenant: Store, type: CreateOrderInput['fulfillment_type']) {
  if (type === 'DELIVERY') return tenant.accepts_delivery;
  if (type === 'PICKUP') return tenant.accepts_pickup;
  return tenant.accepts_in_store;
}

/**
 * Transições de status permitidas. Qualquer mudança fora deste mapa é rejeitada,
 * evitando pulos inconsistentes (ex: PENDING -> COMPLETED direto).
 * CANCELLED é alcançável a partir de qualquer estado não-terminal.
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['OUT_FOR_DELIVERY', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['COMPLETED', 'CANCELLED'],
  READY_FOR_PICKUP: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], // estado terminal
  CANCELLED: [], // estado terminal
};

/**
 * Atualiza o status de um pedido, validando a transição e — se for cancelamento —
 * devolvendo o estoque reservado. Notifica cliente/loja em tempo real via socket.
 */
export async function updateOrderStatus(
  tenantId: string,
  orderId: string,
  newStatus: string,
  reason: string | undefined,
) {
  return withTransaction(async (client) => {
    const currentResult = await client.query(
      `SELECT id, status FROM orders WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
      [orderId, tenantId],
    );

    const current = currentResult.rows[0];
    if (!current) {
      throw new AppError('Pedido não encontrado nesta loja', 404);
    }

    const allowed = ALLOWED_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new AppError(
        `Não é possível mudar de '${current.status}' para '${newStatus}'`,
        422,
      );
    }

    // Cancelamento devolve o estoque reservado no momento da criação do pedido.
    if (newStatus === 'CANCELLED') {
      const itemsResult = await client.query(
        `SELECT product_id, quantity FROM order_items WHERE order_id = $1`,
        [orderId],
      );
      for (const item of itemsResult.rows) {
        await client.query(
          `UPDATE products SET current_stock = current_stock + $1 WHERE id = $2`,
          [item.quantity, item.product_id],
        );
      }
    }

        const updateResult = await client.query(
      `UPDATE orders
          SET status = $1::order_status,
              cancellation_reason = CASE WHEN $1::text = 'CANCELLED' THEN $2 ELSE cancellation_reason END
        WHERE id = $3 AND tenant_id = $4
        RETURNING *`,
      [newStatus, reason ?? null, orderId, tenantId],
    );

    const updatedOrder = updateResult.rows[0];

    emitOrderStatusUpdate(orderId, {
      order_id: orderId,
      status: newStatus,
      reason: newStatus === 'CANCELLED' ? reason ?? null : undefined,
      updated_at: updatedOrder.updated_at,
    });

    return updatedOrder;
  });
}
