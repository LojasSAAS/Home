import bcrypt from 'bcryptjs';
import { withTransaction } from '@/config/database';
import { AppError } from '@/middlewares/error.middleware';
import { signToken } from '@/utils/jwt';
import { RefreshTokenRepository } from '@/modules/auth/refreshToken.repository';
import { OnboardingInput } from './onboarding.schema';

const SALT_ROUNDS = 12;

/**
 * Cria a loja (tenant) e seu primeiro funcionário com papel OWNER numa única
 * transação — se qualquer etapa falhar (ex: slug duplicado), nada é persistido.
 * Já devolve um par access/refresh token, pronto pra logar no painel.
 */
export async function onboardStore(input: OnboardingInput) {
  const { store, owner } = await withTransaction(async (client) => {
    const existingSlug = await client.query(`SELECT id FROM stores WHERE slug = $1 LIMIT 1`, [
      input.store.slug,
    ]);
    if ((existingSlug.rowCount ?? 0) > 0) {
      throw new AppError(`Já existe uma loja com o slug '${input.store.slug}'`, 409);
    }

    const storeResult = await client.query(
      `INSERT INTO stores
         (name, slug, category, accepts_delivery, accepts_pickup, accepts_in_store,
          delivery_radius_km, base_delivery_fee)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.store.name,
        input.store.slug,
        input.store.category,
        input.store.accepts_delivery,
        input.store.accepts_pickup,
        input.store.accepts_in_store,
        input.store.delivery_radius_km,
        input.store.base_delivery_fee,
      ],
    );
    const store = storeResult.rows[0];

    const passwordHash = await bcrypt.hash(input.owner.password, SALT_ROUNDS);

    const staffResult = await client.query(
      `INSERT INTO store_staff (tenant_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'OWNER')
       RETURNING id, tenant_id, name, email, role, created_at`,
      [store.id, input.owner.name, input.owner.email, passwordHash],
    );
    const owner = staffResult.rows[0];

    return { store, owner };
  });

  // Emitido DEPOIS do commit — evita gravar um refresh token válido para
  // uma loja/funcionário cuja transação ainda pode dar rollback.
  const token = signToken({ sub: owner.id, type: 'STORE_STAFF', tenant_id: store.id, role: 'OWNER' });
  const refreshToken = await RefreshTokenRepository.issue({
    subjectId: owner.id,
    subjectType: 'STORE_STAFF',
    tenantId: store.id,
  });

  return { store, owner, token, refreshToken };
}
