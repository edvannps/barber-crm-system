import { z } from 'zod';
import { emailSchema } from './auth.js';
import { INVITATION_STATUSES, MEMBERSHIP_ROLES } from './enums.js';

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(MEMBERSHIP_ROLES),
  unitIds: z.array(z.string().uuid()).min(1).max(50),
  // OWNER não é convidável por este endpoint sem o próprio ator ser OWNER (checado no service, não no schema)
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMembershipSchema = z
  .object({
    role: z.enum(MEMBERSHIP_ROLES).optional(),
    unitIds: z.array(z.string().uuid()).min(1).max(50).optional(),
  })
  .refine((v) => v.role !== undefined || v.unitIds !== undefined, 'Nada para atualizar');
export type UpdateMembershipInput = z.infer<typeof updateMembershipSchema>;

export const membershipResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  role: z.enum(MEMBERSHIP_ROLES),
  unitIds: z.array(z.string().uuid()),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
});
export type MembershipResponse = z.infer<typeof membershipResponseSchema>;

export const invitationResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  role: z.enum(MEMBERSHIP_ROLES),
  unitIds: z.array(z.string().uuid()),
  status: z.enum(INVITATION_STATUSES),
  expiresAt: z.string().datetime(),
});
export type InvitationResponse = z.infer<typeof invitationResponseSchema>;
