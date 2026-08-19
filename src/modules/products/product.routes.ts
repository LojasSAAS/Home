import { Router } from 'express';
import { resolveTenant } from '@/middlewares/tenant.middleware';
import { requireStoreStaffAuth, requireStaffRole } from '@/middlewares/auth.middleware';
import {
  getCatalog,
  getProductByBarcode,
  postProduct,
  patchProductStock,
  patchProductActive,
} from './product.controller';

const router = Router({ mergeParams: true });

// ---- Rotas públicas (consumidas pelo app do cliente) ----

// GET /stores/:slug/catalog?since=2026-08-01T00:00:00Z
router.get('/stores/:slug/catalog', resolveTenant, getCatalog);

// GET /stores/:slug/products/barcode/:code
router.get('/stores/:slug/products/barcode/:code', resolveTenant, getProductByBarcode);

// ---- Rotas do lojista (protegidas por token de store_staff) ----

// POST /stores/:slug/products
router.post('/stores/:slug/products', resolveTenant, requireStoreStaffAuth, postProduct);

// PATCH /stores/:slug/products/:id/stock — apenas OWNER/MANAGER
router.patch(
  '/stores/:slug/products/:id/stock',
  resolveTenant,
  requireStoreStaffAuth,
  requireStaffRole('OWNER', 'MANAGER'),
  patchProductStock,
);

// PATCH /stores/:slug/products/:id/active — apenas OWNER/MANAGER
router.patch(
  '/stores/:slug/products/:id/active',
  resolveTenant,
  requireStoreStaffAuth,
  requireStaffRole('OWNER', 'MANAGER'),
  patchProductActive,
);

export default router;
