import { Router } from 'express';
import { requireCustomerAuth, requireStoreStaffAuth } from '@/middlewares/auth.middleware';
import { resolveTenant } from '@/middlewares/tenant.middleware';
import {
  postOrder,
  getOrders,
  getOrderById,
  patchOrderStatus,
  getMyOrders,
  getMyOrderById,
} from './order.controller';

const router = Router();

// ---- Cliente (protegidas por token de customer) ----

// POST /orders
router.post('/orders', requireCustomerAuth, postOrder);

// GET /orders?status=PENDING&limit=20&offset=0 — "Meus Pedidos"
router.get('/orders', requireCustomerAuth, getMyOrders);

// GET /orders/:id — detalhe de um pedido do próprio cliente
router.get('/orders/:id', requireCustomerAuth, getMyOrderById);

// ---- Painel do lojista (protegidas por token de store_staff) ----

// GET /stores/:slug/orders?status=PENDING
router.get('/stores/:slug/orders', resolveTenant, requireStoreStaffAuth, getOrders);

// GET /stores/:slug/orders/:id
router.get('/stores/:slug/orders/:id', resolveTenant, requireStoreStaffAuth, getOrderById);

// PATCH /stores/:slug/orders/:id/status
router.patch('/stores/:slug/orders/:id/status', resolveTenant, requireStoreStaffAuth, patchOrderStatus);

export default router;
