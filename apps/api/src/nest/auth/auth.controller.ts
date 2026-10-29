import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Headers,
  Inject,
  Optional,
  Post,
  HttpException,
  UseGuards,
} from '@nestjs/common';
import {
  loginRequestSchema,
  registerRequestSchema,
  type LoginRequest,
  updateProfileRequestSchema,
  type RegisterRequest,
  type UpdateProfileRequest,
  type SessionResponse,
  type UserDto,
} from '@gym-up/contracts';
import type { AuthService, Session, User } from '@/lib/contexts/auth/auth.types';
import { AuthGuard, BearerToken, CurrentUser } from '../common/auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { UpdateProfileUseCase } from '@/lib/contexts/workout-tracking/application/update-profile.use-case';
import { profileToUserDto, toUserDto } from '../mappers';
import { AUTH_SERVICE, RATE_LIMITER, type RateLimiter } from '../tokens';

function toSessionResponse(s: Session): SessionResponse {
  return { token: s.sessionId, expiresAt: s.expiresAt.toISOString(), user: toUserDto(s.user) };
}

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AUTH_SERVICE) private readonly auth: AuthService,
    @Inject(UpdateProfileUseCase) private readonly updateProfile: UpdateProfileUseCase,
    @Optional() @Inject(RATE_LIMITER) private readonly limiter?: RateLimiter,
  ) {}

  /** Hashing is memory-hard, so register and login are rate limited per client and email. */
  private async throttle(kind: string, ip: string | undefined, email: string): Promise<void> {
    if (!this.limiter) return;
    const ok = await this.limiter.allow(`${kind}:${ip ?? 'unknown'}:${email.toLowerCase()}`);
    if (!ok) throw new HttpException('Too many attempts, try again later', 429);
  }

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerRequestSchema)) body: RegisterRequest,
    @Headers('cf-connecting-ip') ip?: string,
  ): Promise<SessionResponse> {
    await this.throttle('register', ip, body.email);
    return toSessionResponse(await this.auth.register(body));
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
    @Headers('cf-connecting-ip') ip?: string,
  ): Promise<SessionResponse> {
    await this.throttle('login', ip, body.email);
    return toSessionResponse(await this.auth.login(body));
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async logout(@BearerToken() token: string): Promise<void> {
    await this.auth.logout(token);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: User): UserDto {
    return toUserDto(user);
  }

  /** Settings: display name, weight unit and routine type. */
  @Patch('me')
  @UseGuards(AuthGuard)
  async updateMe(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(updateProfileRequestSchema)) body: UpdateProfileRequest,
  ): Promise<UserDto> {
    return profileToUserDto(await this.updateProfile.execute({ userId: user.id, ...body }));
  }
}
