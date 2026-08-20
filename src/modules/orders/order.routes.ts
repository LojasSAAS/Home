import { Router } from 'express';
import { requireCustomerAuth, requireStoreStaffAuth } from '@/middlewares/auth.middleware';
import { resolveTenant } from '@/middlewares/tenant.middleware';
import { postOrder, getOrders, getOrderById, patchOrderStatus } from './order.controller';

const router = Router();

// POST /orders (protegida: exige token de cliente autenticado)
router.post('/orders', requireCustomerAuth, postOrder);

// ---- Painel do lojista (protegidas por token de store_staff) ----

// GET /stores/:slug/orders?status=PENDING
router.get('/stores/:slug/orders', resolveTenant, requireStoreStaffAuth, getOrders);

// GET /stores/:slug/orders/:id
router.get('/stores/:slug/orders/:id', resolveTenant, requireStoreStaffAuth, getOrderById);

// PATCH /stores/:slug/orders/:id/status
router.patch('/stores/:slug/orders/:id/status', resolveTenant, requireStoreStaffAuth, patchOrderStatus);

export default router;
