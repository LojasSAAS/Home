import { z } from 'zod';

export const registerCustomerSchema = z.object({
  name: z.string().min(2).max(150),
  email: z.string().email(),
  password: z.string().min(8, 'Senha precisa de ao menos 8 caracteres'),
  cpf: z
    .string()
    .regex(/^\d{11}$/, 'CPF deve conter 11 dígitos numéricos')
    .optional(),
  lgpd_accepted: z.literal(true, {
    errorMap: () => ({ message: 'É necessário aceitar os Termos de Uso e a LGPD' }),
  }),
  terms_version: z.string().min(1),
});

export const loginCustomerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const loginStoreStaffSchema = z.object({
  tenant_slug: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

export type RegisterCustomerInput = z.infer<typeof registerCustomerSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});
