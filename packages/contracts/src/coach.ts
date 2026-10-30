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
