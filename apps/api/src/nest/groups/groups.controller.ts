import { Body, Controller, Delete, Get, HttpCode, Inject, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import {
  createGroupRequestSchema,
  joinGroupRequestSchema,
  type CreateGroupRequest,
  type GroupDetailDto,
  type GroupListResponse,
  type GroupSummaryDto,
  type JoinGroupRequest,
  type MemberProfileDto,
} from '@gym-up/contracts';
import type { User } from '@/lib/contexts/auth/auth.types';
import {
  CanViewMemberUseCase,
  CreateGroupUseCase,
  GetGroupUseCase,
  JoinGroupUseCase,
  LeaveGroupUseCase,
  ListGroupsUseCase,
  type ListedGroup,
} from '@/lib/contexts/groups/application/group.use-cases';
import { GetAllMembersUseCase } from '@/lib/contexts/public-view/application/get-all-members.use-case';
import { GetMemberDetailUseCase } from '@/lib/contexts/public-view/application/get-member-detail-use-case';
import { AuthGuard, CurrentUser } from '../common/auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

const summary = (l: ListedGroup, userId: string): GroupSummaryDto => ({
  id: l.group.id,
  name: l.group.name,
  code: l.group.code,
  memberCount: l.memberCount,
  isOwner: l.group.ownerId === userId,
});

/**
 * Groups replace the all-visible family view: a member's workout summary is visible only to people who share
 * a group with them. Photos, nutrition and body data are never exposed here (ADR-005, ADR-023).
 */
@Controller('groups')
@UseGuards(AuthGuard)
export class GroupsController {
  constructor(
    @Inject(ListGroupsUseCase) private readonly list: ListGroupsUseCase,
    @Inject(CreateGroupUseCase) private readonly create: CreateGroupUseCase,
    @Inject(JoinGroupUseCase) private readonly join: JoinGroupUseCase,
    @Inject(LeaveGroupUseCase) private readonly leave: LeaveGroupUseCase,
    @Inject(GetGroupUseCase) private readonly getGroup: GetGroupUseCase,
    @Inject(CanViewMemberUseCase) private readonly canView: CanViewMemberUseCase,
    @Inject(GetAllMembersUseCase) private readonly members: GetAllMembersUseCase,
    @Inject(GetMemberDetailUseCase) private readonly memberDetail: GetMemberDetailUseCase,
  ) {}

  @Get()
  async index(@CurrentUser() user: User): Promise<GroupListResponse> {
    return { items: (await this.list.execute(user.id)).map((l) => summary(l, user.id)) };
  }

  /** Idempotent by the client `id`. */
  @Post()
  @HttpCode(200)
  async add(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createGroupRequestSchema)) body: CreateGroupRequest,
  ): Promise<GroupSummaryDto> {
    return summary(await this.create.execute(user.id, body.id ?? crypto.randomUUID(), body.name), user.id);
  }

  @Post('join')
  @HttpCode(200)
  async joinByCode(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(joinGroupRequestSchema)) body: JoinGroupRequest,
  ): Promise<GroupSummaryDto> {
    return summary(await this.join.execute(user.id, body.code), user.id);
  }

  @Get(':id')
  async show(@CurrentUser() user: User, @Param('id') id: string): Promise<GroupDetailDto> {
    const { group, memberIds } = await this.getGroup.execute(user.id, id);
    const members = await this.members.execute(memberIds);
    return {
      group: summary({ group, memberCount: memberIds.length }, user.id),
      members: members.sort((a, b) => b.currentStreak - a.currentStreak || a.displayName.localeCompare(b.displayName)),
    };
  }

  @Delete(':id/members/me')
  @HttpCode(204)
  async leaveGroup(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    await this.leave.execute(user.id, id);
  }

  /** A member's workout summary, only when you share a group with them. */
  @Get('members/:memberId')
  async member(@CurrentUser() user: User, @Param('memberId') memberId: string): Promise<MemberProfileDto> {
    if (!(await this.canView.execute(user.id, memberId))) throw new NotFoundException('Member not found');
    const detail = await this.memberDetail.execute(memberId);
    if (!detail) throw new NotFoundException('Member not found');
    return detail;
  }
}
