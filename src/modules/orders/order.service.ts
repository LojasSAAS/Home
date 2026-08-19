import { withTransaction } from '@/config/database';
import { AppError } from '@/middlewares/error.middleware';
import { ProductRepository } from '@/modules/products/product.repository';
import { CreateOrderInput } from './order.schema';
import { OrderRepository } from './order.repository';
import { Store } from '@/types';

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
