import { z } from 'zod';
import { MEMBERSHIP_ROLES } from './enums.js';

/** E-mail normalizado na borda (trim + lowercase) — o banco reforça com CHECK email = lower(email). */
export const emailSchema = z.string().trim().toLowerCase().email().max(254);

// Mínimo 8 caracteres; política completa (maiúscula/número) fica para security-reviewer avaliar
// como débito consciente — ver docs/plans/auth.md §5 "Riscos".
export const passwordSchema = z.string().min(8).max(72); // 72 = limite prático de entrada do argon2id

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
  businessName: z.string().trim().min(2).max(120),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const createTenantSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
});
export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const selectTenantSchema = z.object({
  selectTenantToken: z.string().min(1).max(1024),
  tenantId: z.string().uuid(),
});
export type SelectTenantInput = z.infer<typeof selectTenantSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(512),
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const acceptInvitationSchema = z.object({
  // obrigatórios só quando o e-mail convidado ainda não tem User (ver docs/plans/auth.md §2.2,
  // POST /invitations/:token/accept)
  name: z.string().trim().min(2).max(120).optional(),
  password: passwordSchema.optional(),
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export const authTokensResponseSchema = z.object({
  accessToken: z.string(),
  // refreshToken NÃO entra aqui — vai só em cookie httpOnly, nunca no corpo JSON.
  tenantId: z.string().uuid(),
  membershipId: z.string().uuid(),
  role: z.enum(MEMBERSHIP_ROLES),
});
export type AuthTokensResponse = z.infer<typeof authTokensResponseSchema>;

export const tenantSelectionRequiredResponseSchema = z.object({
  selectTenantToken: z.string(),
  tenants: z.array(
    z.object({
      tenantId: z.string().uuid(),
      tenantName: z.string(),
      role: z.enum(MEMBERSHIP_ROLES),
    }),
  ),
});
export type TenantSelectionRequiredResponse = z.infer<typeof tenantSelectionRequiredResponseSchema>;
