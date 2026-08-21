import { Router } from 'express';
import { resolveTenant } from '@/middlewares/tenant.middleware';
import { requireStoreStaffAuth, requireStaffRole } from '@/middlewares/auth.middleware';
import { getStaff, postStaff, patchStaffActive } from './staff.controller';

const router = Router({ mergeParams: true });

// GET /stores/:slug/staff — qualquer funcionário autenticado da loja pode ver
router.get('/stores/:slug/staff', resolveTenant, requireStoreStaffAuth, getStaff);

// POST /stores/:slug/staff — só OWNER convida
router.post('/stores/:slug/staff', resolveTenant, requireStoreStaffAuth, requireStaffRole('OWNER'), postStaff);

// PATCH /stores/:slug/staff/:id/active — só OWNER ativa/desativa
router.patch(
  '/stores/:slug/staff/:id/active',
  resolveTenant,
  requireStoreStaffAuth,
  requireStaffRole('OWNER'),
  patchStaffActive,
);

export default router;
