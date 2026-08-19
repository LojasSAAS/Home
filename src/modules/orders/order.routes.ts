import { Router } from 'express';
import { requireCustomerAuth } from '@/middlewares/auth.middleware';
import { postOrder } from './order.controller';

const router = Router();

// POST /orders (protegida: exige token de cliente autenticado)
router.post('/orders', requireCustomerAuth, postOrder);

export default router;
