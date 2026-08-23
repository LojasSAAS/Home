import { Request, Response, NextFunction } from 'express';
import { onboardingSchema } from './onboarding.schema';
import { onboardStore } from './onboarding.service';

export async function postOnboarding(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = onboardingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido', details: parsed.error.flatten() });
    }

    const { store, owner, token, refreshToken } = await onboardStore(parsed.data);

    return res.status(201).json({
      store,
      owner: { id: owner.id, name: owner.name, email: owner.email, role: owner.role },
      token,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
}
