import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { profiles } from '@db/schema';
import type { Db } from '@/lib/db/client';
import type { AuthService, User } from '@/lib/contexts/auth/auth.types';
import { AUTH_SERVICE, DB } from '../tokens';

const ACCESS_WRITE_INTERVAL_MS = 5 * 60 * 1000;

interface AuthedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: User;
}

/** Resolves `Authorization: Bearer <token>` to a user through the AuthService. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AUTH_SERVICE) private readonly auth: AuthService, @Inject(DB) private readonly db: Db) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers['authorization'];
    const value = Array.isArray(header) ? header[0] : header;
    const token = value?.startsWith('Bearer ') ? value.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('Missing bearer token');

    const user = await this.auth.getCurrentUser(token);
    if (!user) throw new UnauthorizedException('Invalid or expired session');

    try {
      const now = new Date();
      const cutoff = new Date(now.getTime() - ACCESS_WRITE_INTERVAL_MS);
      await this.db
        .update(profiles)
        .set({ lastAccessAt: now })
        .where(and(eq(profiles.id, user.id), or(isNull(profiles.lastAccessAt), lt(profiles.lastAccessAt, cutoff))));
    } catch (error) {
      console.error('Failed to record last authenticated app access', error);
    }

    req.user = user;
    return true;
  }
}

/** Handler parameter: the authenticated user set by AuthGuard. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): User => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user as User;
});

/** Handler parameter: the raw bearer token (used by logout). */
export const BearerToken = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const header = ctx.switchToHttp().getRequest<AuthedRequest>().headers['authorization'];
  const value = Array.isArray(header) ? header[0] : header;
  return value?.startsWith('Bearer ') ? value.slice(7).trim() : '';
});
