import { query } from '@/config/database';
import { Product } from '@/types';

export const ProductRepository = {
  /**
   * Retorna o catálogo completo ativo de uma loja, pronto para o app
   * fazer cache local (funcionamento offline-friendly).
   * `updatedAfter` permite sync incremental (o app manda a última vez que sincronizou).
   */
  async findCatalogByTenant(tenantId: string, updatedAfter?: string): Promise<Product[]> {
    if (updatedAfter) {
      const result = await query<Product>(
        `SELECT id, tenant_id, name, description, price, barcode, sku,
                current_stock, safety_stock, is_active, metadata, updated_at
           FROM products
          WHERE tenant_id = $1 AND is_active = TRUE AND updated_at > $2
          ORDER BY name ASC`,
        [tenantId, updatedAfter],
      );
      return result.rows;
    }

    const result = await query<Product>(
      `SELECT id, tenant_id, name, description, price, barcode, sku,
              current_stock, safety_stock, is_active, metadata, updated_at
         FROM products
        WHERE tenant_id = $1 AND is_active = TRUE
        ORDER BY name ASC`,
      [tenantId],
    );
    return result.rows;
  },

  async findByBarcode(tenantId: string, barcode: string): Promise<Product | null> {
    const result = await query<Product>(
      `SELECT id, tenant_id, name, description, price, barcode, sku,
              current_stock, safety_stock, is_active, metadata, updated_at
         FROM products
        WHERE tenant_id = $1 AND barcode = $2 AND is_active = TRUE
        LIMIT 1`,
      [tenantId, barcode],
    );
    return result.rows[0] ?? null;
  },

  async findByIdsForUpdate(
    tenantId: string,
    productIds: string[],
    client: import('pg').PoolClient,
  ): Promise<Product[]> {
    // FOR UPDATE trava as linhas dentro da transação para evitar overselling
    // quando dois pedidos concorrentes disputam o mesmo produto.
    const result = await client.query<Product>(
      `SELECT id, tenant_id, name, price, current_stock, safety_stock, is_active
         FROM products
        WHERE tenant_id = $1 AND id = ANY($2::uuid[])
        FOR UPDATE`,
      [tenantId, productIds],
    );
    return result.rows;
  },

  async decrementStock(
    productId: string,
    quantity: number,
    client: import('pg').PoolClient,
  ): Promise<void> {
    await client.query(
      `UPDATE products SET current_stock = current_stock - $1 WHERE id = $2`,
      [quantity, productId],
    );
  },

  async create(tenantId: string, input: {
    name: string;
    description?: string;
    price: number;
    barcode?: string;
    sku?: string;
    current_stock: number;
    safety_stock: number;
    metadata?: Record<string, unknown>;
  }): Promise<Product> {
    const result = await query<Product>(
      `INSERT INTO products
         (tenant_id, name, description, price, barcode, sku, current_stock, safety_stock, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        tenantId,
        input.name,
        input.description ?? null,
        input.price,
        input.barcode ?? null,
        input.sku ?? null,
        input.current_stock,
        input.safety_stock,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return result.rows[0];
  },

  /**
   * Ajuste absoluto de estoque (define o novo valor) — usado pelo lojista
   * após uma contagem física, por exemplo. Para descontar por venda, use
   * decrementStock dentro da transação do pedido.
   */
  async setStock(tenantId: string, productId: string, newStock: number): Promise<Product | null> {
    const result = await query<Product>(
      `UPDATE products SET current_stock = $1
        WHERE id = $2 AND tenant_id = $3
        RETURNING *`,
      [newStock, productId, tenantId],
    );
    return result.rows[0] ?? null;
  },

  async setActive(tenantId: string, productId: string, isActive: boolean): Promise<Product | null> {
    const result = await query<Product>(
      `UPDATE products SET is_active = $1
        WHERE id = $2 AND tenant_id = $3
        RETURNING *`,
      [isActive, productId, tenantId],
    );
    return result.rows[0] ?? null;
  },
};
