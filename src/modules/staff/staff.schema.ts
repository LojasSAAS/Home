import { z } from 'zod';

export const inviteStaffSchema = z.object({
  name: z.string().min(2).max(150),
  email: z.string().email(),
  password: z.string().min(8, 'Senha precisa de ao menos 8 caracteres'),
  // OWNER é definido só no onboarding — convites criam apenas MANAGER ou STAFF.
  role: z.enum(['MANAGER', 'STAFF']),
});

export type InviteStaffInput = z.infer<typeof inviteStaffSchema>;
