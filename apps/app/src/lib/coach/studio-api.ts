import {
  studioAccessSchema,
  studioCommentSchema,
  studioHistorySchema,
  studioMemberListSchema,
  studioOverviewSchema,
  studioUserListSchema,
  type StudioAccess,
  type StudioCommentDto,
  type StudioCustomLineRequest,
  type StudioHistoryEntryDto,
  type StudioLineTextRequest,
  type StudioMemberDto,
  type StudioOverview,
  type StudioTakeDto,
  type StudioUserDto,
} from '@gym-up/contracts';
import { api } from '#lib/api/client';
import { API_URL } from '#lib/api/config';
import { tokenStore } from '#lib/api/token';
import type { StudioLine } from './studio';

const auth = (): Record<string, string> => {
  const token = tokenStore.get();
  return token ? { authorization: `Bearer ${token}` } : {};
};

async function raw(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: { ...auth(), ...(init.headers ?? {}) }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    let message = `${res.status}`;
    try {
      message = ((await res.json()) as { message?: string }).message ?? message;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  return res;
}

/** The voice studio's API (see the API's StudioController for who may do what). */
export const studioApi = {
  access: (): Promise<StudioAccess> => api('/studio/access', { schema: studioAccessSchema }),
  overview: (): Promise<StudioOverview> => api('/studio/overview', { schema: studioOverviewSchema }),

  members: async (): Promise<StudioMemberDto[]> => (await api('/studio/members', { schema: studioMemberListSchema })).items,
  searchUsers: async (q: string): Promise<StudioUserDto[]> =>
    (await api(`/studio/users?${new URLSearchParams({ q })}`, { schema: studioUserListSchema })).items,
  grant: (userId: string) => api(`/studio/members/${encodeURIComponent(userId)}`, { method: 'PUT' }),
  revoke: (userId: string) => api(`/studio/members/${encodeURIComponent(userId)}`, { method: 'DELETE' }),

  /** Records (or redoes) my take of a line (`line.text` is its current text). */
  async saveTake(lineId: string, line: StudioLine, take: Blob): Promise<void> {
    const query = new URLSearchParams({ tone: line.tone, locale: line.locale, event: line.event, text: line.text, ...(line.form ? { form: line.form } : {}) });
    await raw(`/studio/lines/${lineId}/take?${query}`, { method: 'PUT', headers: { 'content-type': take.type || 'audio/webm' }, body: take });
  },
  /** A take's audio, kept in Cache Storage (the URL changes with each new take). */
  async takeAudio(t: StudioTakeDto): Promise<Blob> {
    const path = `/studio/takes/${t.id}/audio?v=${t.updatedAt}`;
    let cache: Cache | undefined;
    try {
      cache = await caches.open('coach-studio-takes-v1');
    } catch {
      /* no Cache Storage */
    }
    const hit = await cache?.match(`${API_URL}${path}`);
    if (hit) return hit.blob();
    const res = await raw(path);
    await cache?.put(`${API_URL}${path}`, res.clone()).catch(() => {});
    return res.blob();
  },
  deleteTake: (takeId: string) => api(`/studio/takes/${takeId}`, { method: 'DELETE' }),

  choose: (lineId: string, takeId: string) => api(`/studio/lines/${lineId}/active`, { method: 'PUT', body: { takeId } }),
  clearActive: (lineId: string) => api(`/studio/lines/${lineId}/active`, { method: 'DELETE' }),

  vote: (takeId: string) => api(`/studio/takes/${takeId}/vote`, { method: 'PUT' }),
  unvote: (takeId: string) => api(`/studio/takes/${takeId}/vote`, { method: 'DELETE' }),
  comment: (lineId: string, text: string): Promise<StudioCommentDto> =>
    api(`/studio/lines/${lineId}/comments`, { method: 'POST', body: { text }, schema: studioCommentSchema }),
  deleteComment: (id: string) => api(`/studio/comments/${id}`, { method: 'DELETE' }),

  addLine: (body: StudioCustomLineRequest) => api('/studio/custom-lines', { method: 'POST', body }),
  approveLine: (groupId: string) => api(`/studio/custom-lines/${groupId}/approve`, { method: 'PUT' }),
  deleteLine: (groupId: string) => api(`/studio/custom-lines/${groupId}`, { method: 'DELETE' }),
  editText: (lineId: string, body: StudioLineTextRequest) => api(`/studio/lines/${lineId}/text`, { method: 'PUT', body }),
  revertText: (lineId: string) => api(`/studio/lines/${lineId}/text`, { method: 'DELETE' }),
  history: async (lineId: string): Promise<StudioHistoryEntryDto[]> => (await api(`/studio/lines/${lineId}/history`, { schema: studioHistorySchema })).items,
  confirmTake: (takeId: string) => api(`/studio/takes/${takeId}/confirm`, { method: 'POST' }),
};
