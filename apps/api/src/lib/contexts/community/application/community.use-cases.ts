// src/lib/contexts/community/application/community.use-cases.ts
//
// Community (DR-0028): every signed-in member reads every other member's completed workouts, active routine,
// active supplement names and weekly totals. Writes are limited to likes (never on your own workout) and one
// shared photo per own completed workout. Photo failures never touch the workout itself.

import type {
  CommunityExerciseDto,
  CommunityMemberDto,
  CommunityPageDto,
  CommunityProfileDto,
  CommunityWorkoutDto,
  LikeStateDto,
  WeekTotalsDto,
} from '@gym-up/contracts';
import type { PhotoStorage } from '@/lib/contexts/private-photos/domain/photo-storage';
import { PhotoRules } from '@/lib/contexts/private-photos/domain/private-photos.types';
import { EmptyPhotoBytesError, PhotoSizeExceededError, UnsupportedPhotoFormatError } from '@/lib/contexts/private-photos/application/photos.use-cases';
import type { CommunityMember, CommunityRepository, CommunityWorkout, WorkoutCursor } from '../domain/community.repository';

export const COMMUNITY_PAGE_SIZE = 20;
const DAY_MS = 86_400_000;

export class CommunityNotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = 'CommunityNotFoundError';
  }
}

export class OwnWorkoutLikeError extends Error {
  constructor() {
    super('You cannot like your own workout');
    this.name = 'OwnWorkoutLikeError';
  }
}

export class NotWorkoutOwnerError extends Error {
  constructor() {
    super('Only the author can change this workout photo');
    this.name = 'NotWorkoutOwnerError';
  }
}

const dateKey = (d: Date) => d.toISOString().slice(0, 10);

export function encodeCursor(c: WorkoutCursor): string {
  return btoa(`${c.workoutDateMs}|${c.id}`).replace(/=+$/, '');
}

/** A malformed cursor reads as the first page rather than an error: it carries no authority. */
export function decodeCursor(raw: string | undefined): WorkoutCursor | null {
  if (!raw) return null;
  try {
    const [ms, id] = atob(raw).split('|');
    const workoutDateMs = Number(ms);
    if (!id || !Number.isFinite(workoutDateMs)) return null;
    return { workoutDateMs, id };
  } catch {
    return null;
  }
}

function toDto(w: CommunityWorkout, viewerId: string): CommunityWorkoutDto {
  let durationMinutes: number | null = null;
  if (w.startedAt && w.completedAt) {
    const mins = Math.round((w.completedAt.getTime() - w.startedAt.getTime()) / 60_000);
    // Sessions finished long after (or logged retroactively) would show nonsense durations.
    if (mins > 0 && mins <= 300) durationMinutes = mins;
  }
  return {
    id: w.id,
    author: { id: w.authorId, displayName: w.authorName },
    workoutDate: dateKey(w.workoutDate),
    dayName: w.dayName,
    routineName: w.routineName,
    durationMinutes,
    exercises: w.exercises.map((e): CommunityExerciseDto => ({ ...e })),
    totalSets: w.totalSets,
    volumeKg: Math.round(w.volumeKg),
    hasPhoto: w.hasPhoto,
    likeCount: w.likeCount,
    viewerHasLiked: w.viewerHasLiked,
    isMine: w.authorId === viewerId,
  };
}

function page(items: CommunityWorkout[], viewerId: string): CommunityPageDto {
  const last = items.length === COMMUNITY_PAGE_SIZE ? items[items.length - 1] : undefined;
  return {
    items: items.map((w) => toDto(w, viewerId)),
    nextCursor: last ? encodeCursor({ workoutDateMs: last.workoutDate.getTime(), id: last.id }) : null,
  };
}

const memberDto = (m: CommunityMember): CommunityMemberDto => ({
  id: m.id,
  displayName: m.displayName,
  totalWorkouts: m.totalWorkouts,
  lastWorkout: m.lastWorkout ? dateKey(m.lastWorkout) : null,
});

/** Monday 00:00 UTC of the calendar week containing `day` (YYYY-MM-DD). */
export function weekStartMs(day: string): number {
  const ms = Date.parse(`${day}T00:00:00Z`);
  const weekday = (new Date(ms).getUTCDay() + 6) % 7; // Monday = 0
  return ms - weekday * DAY_MS;
}

export class CommunityUseCases {
  constructor(
    private readonly repo: CommunityRepository,
    private readonly storage: PhotoStorage | null,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Everyone else's completed workouts, whole history included. Your own live on your profile. */
  async feed(viewerId: string, cursor?: string): Promise<CommunityPageDto> {
    const items = await this.repo.listWorkouts({ viewerId, excludeAuthorId: viewerId, cursor: decodeCursor(cursor), limit: COMMUNITY_PAGE_SIZE });
    return page(items, viewerId);
  }

  async memberWorkouts(viewerId: string, memberId: string, cursor?: string): Promise<CommunityPageDto> {
    await this.requireMember(memberId);
    const items = await this.repo.listWorkouts({ viewerId, authorId: memberId, cursor: decodeCursor(cursor), limit: COMMUNITY_PAGE_SIZE });
    return page(items, viewerId);
  }

  async workout(viewerId: string, workoutId: string): Promise<CommunityWorkoutDto> {
    const w = await this.repo.findWorkout(viewerId, workoutId);
    if (!w) throw new CommunityNotFoundError('Workout');
    return toDto(w, viewerId);
  }

  async members(): Promise<CommunityMemberDto[]> {
    return (await this.repo.listMembers()).map(memberDto);
  }

  /** `today` is the viewer's local calendar day, so the week matches what they see; defaults to UTC today. */
  async profile(viewerId: string, memberId: string, today?: string): Promise<CommunityProfileDto> {
    const member = await this.requireMember(memberId);
    const start = weekStartMs(today ?? dateKey(this.now()));
    const week = (from: number) => ({ start: dateKey(new Date(from)), end: dateKey(new Date(from + 6 * DAY_MS)) });
    const [routine, supplements, thisWeek, lastWeek] = await Promise.all([
      this.repo.activeRoutine(memberId),
      this.repo.activeSupplementNames(memberId),
      this.repo.totals(memberId, start, start + 7 * DAY_MS),
      this.repo.totals(memberId, start - 7 * DAY_MS, start),
    ]);
    const totals = (t: typeof thisWeek, from: number): WeekTotalsDto => ({ ...week(from), ...t, volumeKg: Math.round(t.volumeKg) });
    return {
      member: memberDto(member),
      isMe: memberId === viewerId,
      thisWeek: totals(thisWeek, start),
      lastWeek: totals(lastWeek, start - 7 * DAY_MS),
      routine,
      supplements,
    };
  }

  async like(viewerId: string, workoutId: string): Promise<LikeStateDto> {
    const w = await this.repo.findWorkout(viewerId, workoutId);
    if (!w) throw new CommunityNotFoundError('Workout');
    if (w.authorId === viewerId) throw new OwnWorkoutLikeError();
    await this.repo.like(workoutId, viewerId, this.now().getTime());
    return this.repo.likeState(workoutId, viewerId);
  }

  async unlike(viewerId: string, workoutId: string): Promise<LikeStateDto> {
    const w = await this.repo.findWorkout(viewerId, workoutId);
    if (!w) throw new CommunityNotFoundError('Workout');
    await this.repo.unlike(workoutId, viewerId);
    return this.repo.likeState(workoutId, viewerId);
  }

  /** Replaces any earlier photo. The new object is written under a fresh key before the row points at it. */
  async putPhoto(viewerId: string, workoutId: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const storage = this.requireStorage();
    const w = await this.repo.findWorkout(viewerId, workoutId);
    if (!w) throw new CommunityNotFoundError('Workout');
    if (w.authorId !== viewerId) throw new NotWorkoutOwnerError();
    const ext = sniffImage(bytes, contentType);
    const key = `shared/${viewerId}/${workoutId}/${crypto.randomUUID()}.${ext}`;
    const previous = await this.repo.findPhoto(workoutId);
    await storage.put(key, bytes, contentType);
    try {
      await this.repo.savePhoto({ workoutId, ownerId: viewerId, storageKey: key, contentType, bytes: bytes.byteLength, createdAt: this.now().getTime() });
    } catch (err) {
      await storage.delete(key);
      throw err;
    }
    if (previous) await storage.delete(previous.storageKey).catch(() => undefined);
  }

  async deletePhoto(viewerId: string, workoutId: string): Promise<void> {
    const storage = this.requireStorage();
    const photo = await this.repo.findPhoto(workoutId);
    if (!photo) return;
    if (photo.ownerId !== viewerId) throw new NotWorkoutOwnerError();
    await this.repo.deletePhoto(workoutId);
    await storage.delete(photo.storageKey).catch(() => undefined);
  }

  async photo(workoutId: string): Promise<{ bytes: Uint8Array; contentType: string }> {
    const storage = this.requireStorage();
    const photo = await this.repo.findPhoto(workoutId);
    if (!photo) throw new CommunityNotFoundError('Photo');
    const object = await storage.get(photo.storageKey);
    if (!object) throw new CommunityNotFoundError('Photo');
    return { bytes: object.bytes, contentType: photo.contentType };
  }

  private async requireMember(memberId: string): Promise<CommunityMember> {
    const m = await this.repo.findMember(memberId);
    if (!m) throw new CommunityNotFoundError('Member');
    return m;
  }

  private requireStorage(): PhotoStorage {
    if (!this.storage) throw new PhotoStorageUnavailableError();
    return this.storage;
  }
}

export class PhotoStorageUnavailableError extends Error {
  constructor() {
    super('Photo storage is not configured');
    this.name = 'PhotoStorageUnavailableError';
  }
}

/** Checks the real bytes, not only the declared type, so a renamed file cannot pass as an image. */
export function sniffImage(bytes: Uint8Array, contentType: string): 'jpg' | 'png' | 'webp' {
  if (bytes.byteLength === 0) throw new EmptyPhotoBytesError();
  if (bytes.byteLength > PhotoRules.MaxSizeBytes) throw new PhotoSizeExceededError(bytes.byteLength);
  const b = bytes;
  if (contentType === 'image/jpeg' && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (contentType === 'image/png' && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (contentType === 'image/webp' && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return 'webp';
  throw new UnsupportedPhotoFormatError(contentType);
}
