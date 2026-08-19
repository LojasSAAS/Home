import { z } from 'zod';

const orderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const createOrderSchema = z
  .object({
    tenant_slug: z.string().min(1),
    // customer_id NÃO vem do body — é sempre derivado do token JWT autenticado
    // (req.userId), para impedir que um cliente crie pedidos em nome de outro.
    fulfillment_type: z.enum(['DELIVERY', 'PICKUP', 'IN_STORE']),
    items: z.array(orderItemSchema).min(1, 'O pedido precisa de ao menos 1 item'),
    delivery_address: z
      .object({
        street: z.string(),
        number: z.string(),
        neighborhood: z.string(),
        city: z.string(),
        state: z.string().length(2),
        zip_code: z.string(),
        complement: z.string().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
      })
      .optional(),
    notes: z.string().max(500).optional(),
  })
  .refine(
    (data) => data.fulfillment_type !== 'DELIVERY' || !!data.delivery_address,
    { message: 'delivery_address é obrigatório para fulfillment_type DELIVERY', path: ['delivery_address'] },
  );

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
