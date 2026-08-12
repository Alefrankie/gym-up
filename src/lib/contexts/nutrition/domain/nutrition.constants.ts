// src/lib/contexts/nutrition/domain/nutrition.constants.ts
//
// Domain constants for the nutrition context. Mirrors the architecture
// spec (`docs/architecture/contexts/nutrition/readme.md`) and uses
// typed literals (per golden-rules: no raw strings).

/**
 * Photo validation rules. The endpoint enforces these BEFORE calling
 * the AI provider (defense in depth — the client should also compress
 * per FR-NA-002, but the server cannot trust the client).
 */
export const PhotoRules = {
  /** 5MB hard limit. Measured on decoded bytes (not base64 length). */
  MaxSizeBytes: 5 * 1024 * 1024,
  AcceptedFormats: ['jpg', 'png', 'webp'] as const,
} as const;

/**
 * AI analysis rules. Provider is Google Gemini Vision per ADR-014.
 */
export const AIAnalysisRules = {
  /** 30-second timeout, per FR-NA-004. */
  TimeoutMs: 30_000,
  /** Gemini model — pinned by ADR-014. */
  DefaultModel: 'gemini-2.5-flash',
  /** Gemini REST endpoint template (model is injected). */
  GeminiEndpoint:
    'https://generativelanguage.googleapis.com/v1/models/{model}:generateContent',
} as const;

/**
 * Data-URL prefix pattern. Captures the format from
 * `data:image/<fmt>;base64,<payload>` so we can validate the prefix
 * matches the body's `format` field. Case-insensitive.
 */
export const DATA_URL_PREFIX_PATTERN =
  /^data:image\/(jpg|jpeg|png|webp);base64,(.+)$/i;

/**
 * ASCII char codes for the canonical base64 alphabet:
 *   A-Z = 65-90
 *   a-z = 97-122
 *   0-9 = 48-57
 *   +   = 43
 *   /   = 47
 *   =   = 61 (padding, allowed only at end)
 *
 * Node's `Buffer.from(s, 'base64')` is lenient and silently drops
 * invalid characters; that leniency would let a malformed payload
 * slip through and produce a valid-but-wrong image. The handler
 * validates the alphabet manually (no regex — a regex stack-overflows
 * on strings ≥ ~5MB; see https://github.com/nodejs/node/issues/4948).
 */
const BASE64_ALPHABET_LO = 43; // '+'
const BASE64_ALPHABET_HI = 122; // 'z'
/** Reject input whose length is not a multiple of 4 (canonical base64). */
function isCanonicalBase64Length(s: string): boolean {
  return s.length > 0 && s.length % 4 === 0;
}
/** Check every char is in the base64 alphabet and padding is at the end. */
function isCanonicalBase64Chars(s: string): boolean {
  // Walk forward, allowing '=' only in the last two positions.
  const n = s.length;
  for (let i = 0; i < n; i++) {
    const c = s.charCodeAt(i);
    const isUpper = c >= 65 && c <= 90;
    const isLower = c >= 97 && c <= 122;
    const isDigit = c >= 48 && c <= 57;
    const isPlus = c === 43;
    const isSlash = c === 47;
    const isPad = c === 61;
    if (isUpper || isLower || isDigit || isPlus || isSlash) {
      continue;
    }
    if (isPad && i >= n - 2) {
      continue;
    }
    return false;
  }
  return true;
}

export function isValidBase64Payload(s: string): boolean {
  return isCanonicalBase64Length(s) && isCanonicalBase64Chars(s);
}