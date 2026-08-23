import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? '';
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET não configurado');
}

export type TokenSubjectType = 'CUSTOMER' | 'STORE_STAFF';

export interface TokenPayload {
  sub: string; // id do usuário ou do funcionário
  type: TokenSubjectType;
  tenant_id?: string; // presente só para STORE_STAFF (escopo da loja)
  role?: string;
}

export function signToken(payload: TokenPayload, expiresIn: jwt.SignOptions['expiresIn'] = '15m'): string {
  const options: jwt.SignOptions = { expiresIn };
  return jwt.sign(payload, JWT_SECRET, options);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}
