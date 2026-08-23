import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { AppError } from '@/middlewares/error.middleware';
import { inviteStaffSchema } from './staff.schema';
import { StaffRepository } from './staff.repository';
import { RefreshTokenRepository } from '@/modules/auth/refreshToken.repository';

const SALT_ROUNDS = 12;

/**
 * GET /stores/:slug/staff
 * Lista a equipe da loja. Qualquer STORE_STAFF autenticado pode ver
 * (útil pro app mostrar "quem está de plantão"), mas convidar/desativar
 * é restrito a OWNER/MANAGER via requireStaffRole na rota.
 */
export async function getStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const staff = await StaffRepository.findByTenant(tenant.id);
    return res.status(200).json({ staff });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /stores/:slug/staff  (protegida: OWNER)
 * Convida um novo funcionário (MANAGER ou STAFF) pra loja.
 */
export async function postStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;

    const parsed = inviteStaffSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido', details: parsed.error.flatten() });
    }
    const input = parsed.data;

    const existing = await StaffRepository.findByEmailAndTenant(tenant.id, input.email);
    if (existing) {
      throw new AppError('Já existe um funcionário com este e-mail nesta loja', 409);
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    const staff = await StaffRepository.create({
      tenantId: tenant.id,
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
    });

    return res.status(201).json({ staff });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /stores/:slug/staff/:id/active  (protegida: OWNER)
 * Ativa/desativa um funcionário. Desativar bloqueia login e uso do token
 * dele nas próximas requisições (o token antigo continua válido até expirar,
 * mas isso é aceitável dado o TTL de 7 dias — endurecer isso é trabalho futuro).
 */
export async function patchStaffActive(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const { id } = req.params;
    const { is_active } = req.body as { is_active?: boolean };

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active (boolean) é obrigatório' });
    }

    // OWNER não pode se autodesativar — evita a loja ficar sem ninguém com acesso.
    if (id === req.storeStaff!.id && !is_active) {
      throw new AppError('Você não pode desativar sua própria conta', 422);
    }

    const staff = await StaffRepository.setActive(tenant.id, id, is_active);
    if (!staff) {
      return res.status(404).json({ error: 'Funcionário não encontrado nesta loja' });
    }

    // Desativar mata as sessões já abertas na hora — não só bloqueia login novo.
    if (!is_active) {
      await RefreshTokenRepository.revokeAllForSubject(staff.id, 'STORE_STAFF');
    }

    return res.status(200).json({ staff });
  } catch (err) {
    next(err);
  }
}
