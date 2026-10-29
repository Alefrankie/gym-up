import { Controller, Get, Inject, NotFoundException, Param, UseGuards } from '@nestjs/common';
import type { MemberCardDto, MemberProfileDto } from '@gym-up/contracts';
import { GetAllMembersUseCase } from '@/lib/contexts/public-view/application/get-all-members.use-case';
import { GetMemberDetailUseCase } from '@/lib/contexts/public-view/application/get-member-detail-use-case';
import { AuthGuard } from '../common/auth.guard';

/**
 * Family view (ADR-004: write own, read all). Every signed-in user can read every member's workout summary.
 * Photos, nutrition and body data are never exposed here.
 */
@Controller('family')
@UseGuards(AuthGuard)
export class FamilyController {
  constructor(
    @Inject(GetAllMembersUseCase) private readonly allMembers: GetAllMembersUseCase,
    @Inject(GetMemberDetailUseCase) private readonly memberDetail: GetMemberDetailUseCase,
  ) {}

  @Get()
  async members(): Promise<MemberCardDto[]> {
    return this.allMembers.execute();
  }

  @Get(':id')
  async member(@Param('id') id: string): Promise<MemberProfileDto> {
    const detail = await this.memberDetail.execute(id);
    if (!detail) throw new NotFoundException('Member not found');
    return detail;
  }
}
