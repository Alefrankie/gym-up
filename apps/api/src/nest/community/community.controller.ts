import { Body, Controller, Delete, Get, Headers, HttpCode, Inject, Param, Put, Query, Res, UseGuards } from '@nestjs/common';
import type {
  CommunityMemberListDto,
  CommunityPageDto,
  CommunityProfileDto,
  CommunityWorkoutDto,
  LikeStateDto,
} from '@gym-up/contracts';
import type { User } from '@/lib/contexts/auth/auth.types';
import { CommunityUseCases } from '@/lib/contexts/community/application/community.use-cases';
import { AuthGuard, CurrentUser } from '../common/auth.guard';

interface ResponseLike {
  setHeader(name: string, value: string): void;
  send(body: unknown): void;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Community (DR-0028): every signed-in member can read every other member's completed workouts and safe
 * profile projection. Nothing here is reachable without a session; the acting user always comes from it.
 */
@Controller('community')
@UseGuards(AuthGuard)
export class CommunityController {
  constructor(@Inject(CommunityUseCases) private readonly community: CommunityUseCases) {}

  @Get('feed')
  feed(@CurrentUser() user: User, @Query('cursor') cursor?: string): Promise<CommunityPageDto> {
    return this.community.feed(user.id, cursor);
  }

  @Get('members')
  async members(): Promise<CommunityMemberListDto> {
    return { items: await this.community.members() };
  }

  @Get('members/:id')
  profile(@CurrentUser() user: User, @Param('id') id: string, @Query('today') today?: string): Promise<CommunityProfileDto> {
    return this.community.profile(user.id, id, today && DAY.test(today) ? today : undefined);
  }

  @Get('members/:id/workouts')
  memberWorkouts(@CurrentUser() user: User, @Param('id') id: string, @Query('cursor') cursor?: string): Promise<CommunityPageDto> {
    return this.community.memberWorkouts(user.id, id, cursor);
  }

  @Get('workouts/:id')
  workout(@CurrentUser() user: User, @Param('id') id: string): Promise<CommunityWorkoutDto> {
    return this.community.workout(user.id, id);
  }

  @Put('workouts/:id/like')
  like(@CurrentUser() user: User, @Param('id') id: string): Promise<LikeStateDto> {
    return this.community.like(user.id, id);
  }

  @Delete('workouts/:id/like')
  unlike(@CurrentUser() user: User, @Param('id') id: string): Promise<LikeStateDto> {
    return this.community.unlike(user.id, id);
  }

  /** Raw image bytes; the app re-encodes them first, which also drops EXIF and location data. */
  @Put('workouts/:id/photo')
  @HttpCode(204)
  async putPhoto(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Headers('content-type') contentType: string | undefined,
    @Body() body: unknown,
  ): Promise<void> {
    const bytes = body instanceof Uint8Array ? body : new Uint8Array(0);
    await this.community.putPhoto(user.id, id, bytes, (contentType ?? '').split(';')[0]!.trim().toLowerCase());
  }

  @Delete('workouts/:id/photo')
  @HttpCode(204)
  async deletePhoto(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    await this.community.deletePhoto(user.id, id);
  }

  @Get('workouts/:id/photo')
  async photo(@Param('id') id: string, @Res() res: ResponseLike): Promise<void> {
    const { bytes, contentType } = await this.community.photo(id);
    res.setHeader('content-type', contentType);
    res.setHeader('cache-control', 'private, max-age=300');
    res.send(Buffer.from(bytes));
  }
}
