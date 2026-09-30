export const APPOINTMENT_STATUSES = [
  'SCHEDULED',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_SERVICE',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const MEMBERSHIP_ROLES = ['OWNER', 'MANAGER', 'RECEPTION', 'PROFESSIONAL'] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];
