import { describe, expect, it } from 'vitest';
import { chooseSource, recordingId, studioLines, studioRows } from './studio';
import { toExtras } from './catalog.svelte';
import { pickLine, setCatalogExtras } from './pick';

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
    expect(gendered.map((l) => l.form).sort()).toEqual(['f', 'm']);
    expect(lines.find((l) => l.text === 'Suda ahora, presume después.')?.form).toBeNull();
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

describe('studioRows', () => {
  const builtIn = [{ id: 'a'.repeat(32), tone: 'gymrat' as const, locale: 'es' as const, event: 'restEnd' as const, form: null, text: '¡A la barra!' }];
  const custom = [
    { lineId: 'b'.repeat(32), groupId: 'g1', form: 'm' as const, tone: 'flower' as const, locale: 'es' as const, event: 'home' as const, text: 'Hola, guapo', status: 'pending' as const, authorId: 'u2', authorName: 'Ana', createdAt: 1, updatedAt: 1 },
  ];

  it('shows the edited text of a built-in line under the same id, and lists added lines after', () => {
    const rows = studioRows(builtIn, custom, [{ lineId: 'a'.repeat(32), originalText: '¡A la barra!', text: '¡A la barra, ya!', updatedAt: 1, updatedByName: 'Ale' }]);
    expect(rows[0]).toMatchObject({ id: 'a'.repeat(32), text: '¡A la barra, ya!', originalText: '¡A la barra!', edited: true, custom: null });
    expect(rows[1]).toMatchObject({ id: 'b'.repeat(32), text: 'Hola, guapo', form: 'm', custom: { groupId: 'g1', status: 'pending', authorName: 'Ana' } });
  });
});

describe('studio additions in the app', () => {
  it('lets the Coach pick added lines (with their gender words) and say edited texts', () => {
    const extras = toExtras({
      custom: [
        { lineId: 'c'.repeat(32), groupId: 'g', form: 'm', tone: 'normal', locale: 'es', event: 'finish', text: 'Listo, campeón.' },
        { lineId: 'd'.repeat(32), groupId: 'g', form: 'f', tone: 'normal', locale: 'es', event: 'finish', text: 'Lista, campeona.' },
      ],
      overrides: [{ lineId: 'e'.repeat(32), originalText: 'Suda ahora, presume después.', text: 'Suda hoy, presume mañana.' }],
    });
    expect(extras.lines).toEqual([{ tone: 'normal', locale: 'es', event: 'finish', template: '{Listo, campeón.|Lista, campeona.}' }]);
    setCatalogExtras(extras);
    try {
      const said = new Set<string>();
      for (let i = 0; i < 400; i++) said.add(pickLine('finish', { tone: 'normal', addressForm: 'f', locale: 'es', random: () => i / 400 })!.text);
      expect(said.has('Lista, campeona.')).toBe(true);
      expect(said.has('Listo, campeón.')).toBe(false);
      const home = new Set<string>();
      for (let i = 0; i < 400; i++) home.add(pickLine('home', { tone: 'normal', addressForm: 'm', locale: 'es', now: new Date(2026, 9, 31, 13), random: () => i / 400 })!.text);
      expect(home.has('Suda hoy, presume mañana.')).toBe(true);
      expect(home.has('Suda ahora, presume después.')).toBe(false);
    } finally {
      setCatalogExtras({ lines: [], overrides: new Map() });
    }
  });
});
