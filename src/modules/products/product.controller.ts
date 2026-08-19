import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ProductRepository } from './product.repository';
import { AppError } from '@/middlewares/error.middleware';
import { createProductSchema, setStockSchema, setActiveSchema } from './product.schema';

/**
 * GET /stores/:slug/catalog
 * Otimizado para o app mobile cachear o catálogo localmente e funcionar
 * mesmo com conexão instável dentro da loja física.
 *
 * - Suporta ?since=<ISO timestamp> para sync incremental (só retorna o que mudou).
 * - Envia ETag + Cache-Control para o app poder usar 304 Not Modified.
 */
export async function getCatalog(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const since = typeof req.query.since === 'string' ? req.query.since : undefined;

    const products = await ProductRepository.findCatalogByTenant(tenant.id, since);

    const payload = {
      store: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        category: tenant.category,
        accepts_delivery: tenant.accepts_delivery,
        accepts_pickup: tenant.accepts_pickup,
        accepts_in_store: tenant.accepts_in_store,
      },
      synced_at: new Date().toISOString(),
      products,
    };

    // ETag baseado no conteúdo permite ao cliente evitar re-baixar catálogo
    // não modificado, poupando dados em conexões ruins.
    const etag = crypto.createHash('md5').update(JSON.stringify(payload.products)).digest('hex');

    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=60'); // app decide TTL local de cache
    return res.status(200).json(payload);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /stores/:slug/products/barcode/:code
 * Usado no fluxo IN_STORE: cliente escaneia o produto na prateleira.
 */
export async function getProductByBarcode(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const { code } = req.params;

    const product = await ProductRepository.findByBarcode(tenant.id, code);
    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado nesta loja' });
    }

    return res.status(200).json(product);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /stores/:slug/products  (protegida: requireStoreStaffAuth)
 * Cadastro de produto pelo lojista.
 */
export async function postProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido', details: parsed.error.flatten() });
    }

    if (parsed.data.safety_stock > parsed.data.current_stock) {
      throw new AppError('safety_stock não pode ser maior que current_stock', 422);
    }

    const product = await ProductRepository.create(tenant.id, parsed.data);
    return res.status(201).json(product);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /stores/:slug/products/:id/stock  (protegida: requireStoreStaffAuth)
 * Ajuste absoluto de estoque — ex: após contagem física no balcão.
 */
export async function patchProductStock(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const { id } = req.params;

    const parsed = setStockSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido', details: parsed.error.flatten() });
    }

    const product = await ProductRepository.setStock(tenant.id, id, parsed.data.current_stock);
    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado nesta loja' });
    }

    return res.status(200).json(product);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /stores/:slug/products/:id/active  (protegida: requireStoreStaffAuth)
 * Ativa/desativa um produto (ex: esgotou de vez, saiu de linha).
 */
export async function patchProductActive(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const { id } = req.params;

    const parsed = setActiveSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido' });
    }

    const product = await ProductRepository.setActive(tenant.id, id, parsed.data.is_active);
    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado nesta loja' });
    }

    return res.status(200).json(product);
  } catch (err) {
    next(err);
  }
}
