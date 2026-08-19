import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '@/config/database';
import { AppError } from '@/middlewares/error.middleware';
import { signToken } from '@/utils/jwt';
import { AuthRepository } from './auth.repository';
import { registerCustomerSchema, loginCustomerSchema, loginStoreStaffSchema } from './auth.schema';

const SALT_ROUNDS = 12;

/**
 * POST /auth/register
 * Cadastro de cliente final. Exige aceite explícito de LGPD (lgpd_accepted: true)
 * já na criação — o registro de aceite fica gravado com timestamp e versão.
 */
export async function registerCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = registerCustomerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido', details: parsed.error.flatten() });
    }
    const input = parsed.data;

    const existing = await AuthRepository.findUserByEmail(input.email);
    if (existing) {
      throw new AppError('Já existe uma conta com este e-mail', 409);
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    const result = await query(
      `INSERT INTO users (name, email, password_hash, cpf, lgpd_accepted, terms_accepted_at, terms_version)
       VALUES ($1, $2, $3, $4, TRUE, now(), $5)
       RETURNING id, name, email, created_at`,
      [input.name, input.email, passwordHash, input.cpf ?? null, input.terms_version],
    );

    const user = result.rows[0];
    const token = signToken({ sub: user.id, type: 'CUSTOMER' });

    return res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/login
 */
export async function loginCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = loginCustomerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido' });
    }

    const { email, password } = parsed.data;
    const user = await AuthRepository.findUserByEmail(email);

    // Mesma mensagem de erro para e-mail inexistente ou senha errada —
    // evita enumeração de contas cadastradas.
    if (!user || !user.is_active) {
      throw new AppError('E-mail ou senha inválidos', 401);
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new AppError('E-mail ou senha inválidos', 401);
    }

    const token = signToken({ sub: user.id, type: 'CUSTOMER' });
    return res.status(200).json({
      user: { id: user.id, name: user.name, email: user.email },
      token,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/store-login
 * Login do lado do lojista. Precisa do slug da loja porque o e-mail só é
 * único DENTRO de um tenant (a mesma pessoa pode gerenciar 2 lojas).
 */
export async function loginStoreStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = loginStoreStaffSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido' });
    }
    const { tenant_slug, email, password } = parsed.data;

    const tenantResult = await query(`SELECT id FROM stores WHERE slug = $1 AND is_active = TRUE LIMIT 1`, [
      tenant_slug,
    ]);
    if (tenantResult.rowCount === 0) {
      throw new AppError('Loja não encontrada', 404);
    }
    const tenantId = tenantResult.rows[0].id;

    const staff = await AuthRepository.findStaffByEmailAndTenant(tenantId, email);
    if (!staff || !staff.is_active) {
      throw new AppError('E-mail ou senha inválidos', 401);
    }

    const valid = await bcrypt.compare(password, staff.password_hash);
    if (!valid) {
      throw new AppError('E-mail ou senha inválidos', 401);
    }

    const token = signToken({ sub: staff.id, type: 'STORE_STAFF', tenant_id: tenantId, role: staff.role });
    return res.status(200).json({
      staff: { id: staff.id, name: staff.name, email: staff.email, role: staff.role },
      token,
    });
  } catch (err) {
    next(err);
  }
}
