import type { User } from '@/lib/contexts/auth/auth.types';

/** The app's admins: they manage feedback and record the Coach's lines in the voice studio. */
const ADMINS = new Set(['alefrank.m@gmail.com']);

export const isAdmin = (user: Pick<User, 'email'>): boolean => ADMINS.has(user.email.trim().toLowerCase());
