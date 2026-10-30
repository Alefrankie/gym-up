import { describe, expect, it } from 'vitest';
import { chooseSource, recordingId, studioLines } from './studio';

describe('studio lines', () => {
  const lines = studioLines();

  it('lists every line without values, Spanish first, with gender words already chosen', () => {
    expect(lines.length).toBeGreaterThan(1000);
    const firstEn = lines.findIndex((l) => l.locale === 'en');
    expect(lines.slice(firstEn).every((l) => l.locale === 'en')).toBe(true);
    for (const l of lines) expect(/[{}|]/.test(l.text), l.text).toBe(false);
  });

  it('records a line once per address form only when the form changes the words', () => {
    const gendered = lines.filter((l) => l.text.startsWith('Vas a terminar el entreno'));
    expect(gendered.map((l) => l.form).sort()).toEqual(['f', 'm', 'neutral']);
    expect(lines.find((l) => l.text === 'Hoy no se negocia. Se entrena.')?.form).toBeNull();
  });

  it('never lists the same line twice', () => {
    const keys = lines.map((l) => `${l.tone}|${l.locale}|${l.event}|${l.text}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('recordingId', () => {
  it('is a stable 32-character hash of the slot and the words', async () => {
    const a = await recordingId('¡Dale que vamos!');
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(await recordingId(' ¡Dale que vamos! ')).toBe(a);
    expect(await recordingId('¡Dale que vamos!', 'other')).not.toBe(a);
    expect(await recordingId('¡Dale que vamos')).not.toBe(a);
  });
});

describe('chooseSource', () => {
  it('plays a studio recording first, then the chosen cloud voice, then the phone', () => {
    expect(chooseSource({ recorded: true, cloudChosen: true, cloudAvailable: true })).toBe('recording');
    expect(chooseSource({ recorded: true, cloudChosen: false, cloudAvailable: false })).toBe('recording');
    expect(chooseSource({ recorded: false, cloudChosen: true, cloudAvailable: true })).toBe('cloud');
    expect(chooseSource({ recorded: false, cloudChosen: true, cloudAvailable: false })).toBe('phone');
    expect(chooseSource({ recorded: false, cloudChosen: false, cloudAvailable: true })).toBe('phone');
  });
});
