import { z } from 'zod';

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const onboardingSchema = z.object({
  store: z.object({
    name: z.string().min(2).max(150),
    slug: z
      .string()
      .min(2)
      .max(150)
      .regex(slugRegex, 'slug deve conter apenas letras minúsculas, números e hífens'),
    category: z.enum(['BURGER', 'PET', 'CLOTHING', 'MARKET', 'OTHER']).default('OTHER'),
    accepts_delivery: z.boolean().default(true),
    accepts_pickup: z.boolean().default(true),
    accepts_in_store: z.boolean().default(true),
    delivery_radius_km: z.number().nonnegative().default(5),
    base_delivery_fee: z.number().nonnegative().default(0),
  }),
  owner: z.object({
    name: z.string().min(2).max(150),
    email: z.string().email(),
    password: z.string().min(8, 'Senha precisa de ao menos 8 caracteres'),
  }),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
