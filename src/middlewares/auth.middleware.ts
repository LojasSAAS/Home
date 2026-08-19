import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@/utils/jwt';
import { AppError } from './error.middleware';

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
}

/**
 * Exige um token de CUSTOMER válido. Anexa req.userId.
 */
export function requireCustomerAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) throw new AppError('Token de autenticação ausente', 401);

    const payload = verifyToken(token);
    if (payload.type !== 'CUSTOMER') throw new AppError('Token inválido para este recurso', 403);

    req.userId = payload.sub;
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(new AppError('Token inválido ou expirado', 401));
  }
}

/**
 * Exige um token de STORE_STAFF válido E que o tenant do token bata com
 * o tenant resolvido na rota (req.tenant, via resolveTenant) — impede que
 * o funcionário de uma loja gerencie o catálogo de outra loja.
 */
export function requireStoreStaffAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) throw new AppError('Token de autenticação ausente', 401);

    const payload = verifyToken(token);
    if (payload.type !== 'STORE_STAFF' || !payload.tenant_id) {
      throw new AppError('Token inválido para este recurso', 403);
    }

    if (req.tenant && payload.tenant_id !== req.tenant.id) {
      throw new AppError('Este usuário não tem acesso a esta loja', 403);
    }

    req.storeStaff = { id: payload.sub, tenant_id: payload.tenant_id, role: payload.role ?? 'STAFF' };
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(new AppError('Token inválido ou expirado', 401));
  }
}

/**
 * Restringe a determinados papéis (ex: só OWNER/MANAGER pode editar estoque).
 * Usar sempre depois de requireStoreStaffAuth.
 */
export function requireStaffRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.storeStaff || !roles.includes(req.storeStaff.role)) {
      return next(new AppError('Permissão insuficiente para esta ação', 403));
    }
    next();
  };
}
