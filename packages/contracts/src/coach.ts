import { z } from 'zod';

/**
 * Coach voices generated in the cloud (Workers AI, Deepgram Aura-2), all male. The id says provider and speaker
 * so another provider can be added without touching the app.
 */
export const COACH_CLOUD_VOICES = ['aura:sirio', 'aura:javier', 'aura:nestor', 'aura:alvaro'] as const;
export const coachCloudVoiceSchema = z.enum(COACH_CLOUD_VOICES);
export type CoachCloudVoice = z.infer<typeof coachCloudVoiceSchema>;

/** `GET /coach/voice`: one Coach line as audio (Ogg Opus), cached by voice, language and text. */
export const coachVoiceQuerySchema = z.object({
  voice: coachCloudVoiceSchema,
  lang: z.enum(['es', 'en']).default('es'),
  text: z.string().trim().min(1).max(300),
});
export type CoachVoiceQuery = z.infer<typeof coachVoiceQuerySchema>;

/** One recording of a Coach line made in the voice studio. `id` = hash of the voice slot and the rendered line. */
export const coachRecordingIdSchema = z.string().regex(/^[0-9a-f]{32}$/);

export const coachRecordingMetaSchema = z.object({
  tone: z.enum(['flower', 'normal', 'hard', 'gymrat']),
  locale: z.enum(['es', 'en']),
  event: z.string().min(1).max(40),
  /** The address form this rendering is for, or null when the line reads the same for everyone. */
  form: z.enum(['m', 'f']).nullable(),
  text: z.string().trim().min(1).max(300),
});
export type CoachRecordingMeta = z.infer<typeof coachRecordingMetaSchema>;

export const coachRecordingSchema = coachRecordingMetaSchema.extend({
  id: coachRecordingIdSchema,
  contentType: z.string(),
  bytes: z.number().int(),
  /** Changes when the line is re-recorded; part of the audio URL so caches pick up the new take. */
  updatedAt: z.number().int(),
});
export type CoachRecordingDto = z.infer<typeof coachRecordingSchema>;

export const coachRecordingListSchema = z.object({ items: z.array(coachRecordingSchema) });
export type CoachRecordingList = z.infer<typeof coachRecordingListSchema>;

/** Audio formats a recording may be uploaded in (what MediaRecorder produces on Android and desktop). */
export const COACH_RECORDING_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/wav'] as const;
export const COACH_RECORDING_MAX_BYTES = 1_000_000;
