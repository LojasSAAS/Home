import { Router } from 'express';
import { postOnboarding } from './onboarding.controller';

const router = Router();

// POST /onboarding/store
router.post('/onboarding/store', postOnboarding);

export default router;
