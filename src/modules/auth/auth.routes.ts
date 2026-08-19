import { Router } from 'express';
import { registerCustomer, loginCustomer, loginStoreStaff } from './auth.controller';

const router = Router();

router.post('/auth/register', registerCustomer);
router.post('/auth/login', loginCustomer);
router.post('/auth/store-login', loginStoreStaff);

export default router;
