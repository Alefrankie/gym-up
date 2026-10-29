import type { Group } from '@db/schema';
import {
  GroupFullError,
  GroupLimitError,
  GroupNotFoundError,
  MAX_GROUP_MEMBERS,
  MAX_GROUPS_PER_USER,
  type GroupRepository,
} from '../domain/group.repository';

// No 0/O/1/I: codes are read aloud and typed on a phone.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export interface ListedGroup {
  group: Group;
  memberCount: number;
}

export class ListGroupsUseCase {
  constructor(private readonly repo: GroupRepository) {}
  execute(userId: string): Promise<ListedGroup[]> {
    return this.repo.listForUser(userId);
  }
}

export class CreateGroupUseCase {
  constructor(private readonly repo: GroupRepository) {}

  async execute(userId: string, id: string, name: string): Promise<ListedGroup> {
    // Replaying an offline create returns the stored group.
    const existing = await this.repo.findById(id);
    if (existing) {
      if (!(await this.repo.isMember(id, userId))) throw new GroupNotFoundError();
      return { group: existing, memberCount: (await this.repo.memberIds(id)).length };
    }
    if ((await this.repo.countGroupsOf(userId)) >= MAX_GROUPS_PER_USER) throw new GroupLimitError();
    let group: Group | undefined;
    for (let attempt = 0; attempt < 5 && !group; attempt++) {
      try {
        group = await this.repo.create({ id, name, code: newCode(), ownerId: userId });
      } catch (err) {
        // Code collision on the unique index: try another code.
        if (!(err instanceof Error && /UNIQUE/i.test(err.message))) throw err;
      }
    }
    if (!group) throw new Error('Could not generate a group code');
    await this.repo.addMember(group.id, userId);
    return { group, memberCount: 1 };
  }
}

export class JoinGroupUseCase {
  constructor(private readonly repo: GroupRepository) {}

  async execute(userId: string, code: string): Promise<ListedGroup> {
    const group = await this.repo.findByCode(code);
    if (!group) throw new GroupNotFoundError();
    const members = await this.repo.memberIds(group.id);
    if (!members.includes(userId)) {
      if (members.length >= MAX_GROUP_MEMBERS) throw new GroupFullError();
      if ((await this.repo.countGroupsOf(userId)) >= MAX_GROUPS_PER_USER) throw new GroupLimitError();
      await this.repo.addMember(group.id, userId);
      members.push(userId);
    }
    return { group, memberCount: members.length };
  }
}

export class LeaveGroupUseCase {
  constructor(private readonly repo: GroupRepository) {}
  async execute(userId: string, groupId: string): Promise<void> {
    if (!(await this.repo.isMember(groupId, userId))) throw new GroupNotFoundError();
    await this.repo.removeMember(groupId, userId);
  }
}

/** Members of a group the caller belongs to; a group the caller is not in does not exist for them. */
export class GetGroupUseCase {
  constructor(private readonly repo: GroupRepository) {}
  async execute(userId: string, groupId: string): Promise<{ group: Group; memberIds: string[] }> {
    const group = await this.repo.findById(groupId);
    if (!group || !(await this.repo.isMember(groupId, userId))) throw new GroupNotFoundError();
    return { group, memberIds: await this.repo.memberIds(groupId) };
  }
}

/** A member's profile is visible to you only when you share a group (or it is you). */
export class CanViewMemberUseCase {
  constructor(private readonly repo: GroupRepository) {}
  async execute(viewerId: string, memberId: string): Promise<boolean> {
    return viewerId === memberId || this.repo.shareGroup(viewerId, memberId);
  }
}
