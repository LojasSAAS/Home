import { Router } from 'express';
import { registerCustomer, loginCustomer, loginStoreStaff, refreshTokenHandler, logout } from './auth.controller';

const router = Router();

router.post('/auth/register', registerCustomer);
router.post('/auth/login', loginCustomer);
router.post('/auth/store-login', loginStoreStaff);
router.post('/auth/refresh', refreshTokenHandler);
router.post('/auth/logout', logout);

export default router;
