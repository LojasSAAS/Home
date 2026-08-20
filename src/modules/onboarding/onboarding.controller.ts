import { Request, Response, NextFunction } from 'express';
import { onboardingSchema } from './onboarding.schema';
import { onboardStore } from './onboarding.service';

/**
 * POST /onboarding/store
 * Body: { store: {...}, owner: {...} }
 *
 * Cadastro self-service de uma nova loja no SaaS: cria o tenant e o primeiro
 * funcionário (OWNER) numa tacada só, sem precisar de insert manual no banco.
 */
export async function postOnboarding(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = onboardingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido', details: parsed.error.flatten() });
    }

    const { store, owner, token } = await onboardStore(parsed.data);

    return res.status(201).json({
      store,
      owner: { id: owner.id, name: owner.name, email: owner.email, role: owner.role },
      token,
    });
  } catch (err) {
    next(err);
  }
}
