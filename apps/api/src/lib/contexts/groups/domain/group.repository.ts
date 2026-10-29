import type { Group } from '@db/schema';

export const MAX_GROUP_MEMBERS = 20;
export const MAX_GROUPS_PER_USER = 10;

export class GroupNotFoundError extends Error {
  constructor() {
    super('Group not found');
    this.name = 'GroupNotFoundError';
  }
}

export class GroupFullError extends Error {
  constructor() {
    super(`A group has at most ${MAX_GROUP_MEMBERS} members`);
    this.name = 'GroupFullError';
  }
}

export class GroupLimitError extends Error {
  constructor() {
    super(`You can be in at most ${MAX_GROUPS_PER_USER} groups`);
    this.name = 'GroupLimitError';
  }
}

export abstract class GroupRepository {
  abstract findById(id: string): Promise<Group | undefined>;
  abstract findByCode(code: string): Promise<Group | undefined>;
  abstract listForUser(userId: string): Promise<Array<{ group: Group; memberCount: number }>>;
  abstract memberIds(groupId: string): Promise<string[]>;
  abstract isMember(groupId: string, userId: string): Promise<boolean>;
  abstract countGroupsOf(userId: string): Promise<number>;
  abstract create(input: { id: string; name: string; code: string; ownerId: string }): Promise<Group>;
  abstract addMember(groupId: string, userId: string): Promise<void>;
  abstract removeMember(groupId: string, userId: string): Promise<void>;
  /** True when `a` and `b` share at least one group. */
  abstract shareGroup(a: string, b: string): Promise<boolean>;
}
