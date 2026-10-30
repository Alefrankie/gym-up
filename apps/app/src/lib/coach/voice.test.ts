import { describe, expect, it } from 'vitest';
import { CLOUD_OPTIONS, chooseBackend, parseVoiceId, toDownload } from './voice.svelte';

describe('chooseBackend', () => {
  it('uses Android TextToSpeech in the app, where the WebView has no speechSynthesis', () => {
    expect(chooseBackend({ inApp: true, maleSystemVoice: false })).toBe('native');
    expect(chooseBackend({ inApp: true, maleSystemVoice: true })).toBe('native');
  });

  it('uses a male browser voice when there is one, else the on-device voice', () => {
    expect(chooseBackend({ inApp: false, maleSystemVoice: true })).toBe('system');
    expect(chooseBackend({ inApp: false, maleSystemVoice: false })).toBe('device');
  });
});

describe('toDownload', () => {
  it('shows megabytes and percent from the overall progress', () => {
    expect(toDownload({ status: 'progress_total', loaded: 42 * 1048576, total: 84 * 1048576 }, true)).toEqual({
      phase: 'download',
      loadedMb: 42,
      totalMb: 84,
      percent: 50,
    });
  });

  it('uses per-file progress until totals arrive, then ignores it', () => {
    expect(toDownload({ status: 'progress', progress: 12.4, loaded: 1048576, total: 8 * 1048576 }, false)).toMatchObject({ phase: 'download', percent: 12 });
    expect(toDownload({ status: 'progress', progress: 12.4 }, true)).toBeNull();
  });

  it('moves to loading, then ready', () => {
    expect(toDownload({ status: 'loading', progress: 0 }, false)).toEqual({ phase: 'load' });
    expect(toDownload({ status: 'ready', progress: 100 }, true)).toEqual({ phase: 'ready' });
  });
});

describe('parseVoiceId', () => {
  it('keeps the automatic phone voice, a specific Android voice and the male cloud voices', () => {
    expect(parseVoiceId(null)).toBe('auto');
    expect(parseVoiceId('native:es-us-x-esd-local')).toBe('native:es-us-x-esd-local');
    expect(parseVoiceId('aura:sirio')).toBe('aura:sirio');
  });

  it('falls back to automatic for anything else (female or unknown voices, empty ids)', () => {
    expect(parseVoiceId('aura:aquila')).toBe('auto');
    expect(parseVoiceId('native:')).toBe('auto');
    expect(parseVoiceId('kokoro')).toBe('auto');
  });

  it('offers the four male cloud voices to compare', () => {
    expect(CLOUD_OPTIONS.map((o) => o.name)).toEqual(['sirio', 'javier', 'nestor', 'alvaro']);
  });
});
