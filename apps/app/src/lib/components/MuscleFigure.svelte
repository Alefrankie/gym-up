<script lang="ts" module>
  type Region = { muscle: string; view: 'front' | 'back'; d: string; mirror: boolean };

  // One half is drawn (left side of the figure) and mirrored; `mirror: false` regions are centred.
  // Coordinates live in a 100 x 200 box, figure centred on x = 50.
  const REGIONS: Region[] = [
    // front
    { muscle: 'traps', view: 'front', d: 'M44 23 L50 23 L50 31 L40 31 Z', mirror: true },
    { muscle: 'shoulders', view: 'front', d: 'M31 33 Q22 34 21 45 L29 47 L34 38 Z', mirror: true },
    { muscle: 'chest', view: 'front', d: 'M35 35 Q43 33 49.4 36 L49.4 53 Q41 57 33 51 L33 41 Z', mirror: true },
    { muscle: 'biceps', view: 'front', d: 'M20 49 L28 50 L27 68 L18 67 Z', mirror: true },
    { muscle: 'forearms', view: 'front', d: 'M17 70 L26 71 L24 95 L14 93 Z', mirror: true },
    { muscle: 'abdominals', view: 'front', d: 'M39 56 L49.4 56 L49.4 94 Q43 96 40 92 Z', mirror: true },
    { muscle: 'abductors', view: 'front', d: 'M31 98 L36 98 L36 128 L31 126 Z', mirror: true },
    { muscle: 'quadriceps', view: 'front', d: 'M37 100 L48.4 102 L47 142 L37 142 Z', mirror: true },
    { muscle: 'adductors', view: 'front', d: 'M48.4 106 L49.4 106 L49.4 130 L44 132 Z', mirror: true },
    { muscle: 'calves', view: 'front', d: 'M36 148 L46 148 L44 186 L37 186 Z', mirror: true },
    // back
    { muscle: 'traps', view: 'back', d: 'M44 22 L50 22 L50 50 L33 36 Z', mirror: true },
    { muscle: 'shoulders', view: 'back', d: 'M31 33 Q22 34 21 45 L29 47 L34 38 Z', mirror: true },
    { muscle: 'upper_back', view: 'back', d: 'M36 40 L49.4 52 L49.4 62 L38 60 Z', mirror: true },
    { muscle: 'lats', view: 'back', d: 'M33 50 L37 62 L41 76 L35 70 L31 56 Z', mirror: true },
    { muscle: 'lower_back', view: 'back', d: 'M42 66 L49.4 66 L49.4 92 L41 92 Z', mirror: true },
    { muscle: 'triceps', view: 'back', d: 'M20 49 L28 50 L27 68 L18 67 Z', mirror: true },
    { muscle: 'forearms', view: 'back', d: 'M17 70 L26 71 L24 95 L14 93 Z', mirror: true },
    { muscle: 'glutes', view: 'back', d: 'M34 96 L49.4 96 L49.4 118 Q40 124 33 114 Z', mirror: true },
    { muscle: 'hamstrings', view: 'back', d: 'M34 120 L48.4 122 L47 148 L36 148 Z', mirror: true },
    { muscle: 'abductors', view: 'back', d: 'M30 98 L33 98 L33 118 L30 116 Z', mirror: true },
    { muscle: 'calves', view: 'back', d: 'M36 152 L46 152 L44 186 L37 186 Z', mirror: true },
  ];

  /** The view that shows a muscle best. */
  export function viewFor(muscle: string): 'front' | 'back' {
    return ['traps', 'upper_back', 'lats', 'lower_back', 'glutes', 'hamstrings', 'triceps'].includes(muscle) ? 'back' : 'front';
  }

  const SILHOUETTE =
    'M32 30 Q50 25 68 30 L66 60 L62 96 L66 100 L68 150 L64 192 L52 192 L50 150 L48 192 L36 192 L32 150 L34 100 L38 96 L34 60 Z' +
    ' M30 32 Q19 36 17 50 L13 76 L11 98 L22 101 L26 80 L31 56 Z' +
    ' M70 32 Q81 36 83 50 L87 76 L89 98 L78 101 L74 80 L69 56 Z';
</script>

<script lang="ts">
  let {
    primary,
    secondary = [],
    view = 'auto',
    size = 56,
    label,
  }: {
    primary: string;
    secondary?: string[];
    view?: 'auto' | 'front' | 'back' | 'both';
    size?: number;
    label?: string;
  } = $props();

  const views = $derived<Array<'front' | 'back'>>(
    view === 'both' ? ['front', 'back'] : [view === 'auto' ? viewFor(primary) : view],
  );

  const tone = (m: string) => (m === primary ? 'p' : secondary.includes(m) ? 's' : 'n');
</script>

<svg
  class="fig"
  viewBox={views.length === 2 ? '0 0 210 200' : '0 0 100 200'}
  width={views.length === 2 ? size * 2.1 : size}
  height={size * 2}
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
>
  {#each views as v, i}
    <g transform={`translate(${i * 110} 0)`}>
      <circle cx="50" cy="14" r="9" class="body" />
      <rect x="45" y="22" width="10" height="7" class="body" />
      <path d={SILHOUETTE} class="body" />
      <ellipse cx="17" cy="104" rx="5.5" ry="7" class="body" />
      <ellipse cx="83" cy="104" rx="5.5" ry="7" class="body" />
      <ellipse cx="42" cy="194" rx="8" ry="4" class="body" />
      <ellipse cx="58" cy="194" rx="8" ry="4" class="body" />
      {#each REGIONS.filter((r) => r.view === v) as r}
        <path d={r.d} class={`m ${tone(r.muscle)}`} />
        {#if r.mirror}
          <path d={r.d} class={`m ${tone(r.muscle)}`} transform="translate(100 0) scale(-1 1)" />
        {/if}
      {/each}
    </g>
  {/each}
</svg>

<style>
  .fig {
    flex: none;
    display: block;
  }
  .body {
    fill: #4a3d31;
  }
  .m {
    stroke: #29231d;
    stroke-width: 1.1;
    stroke-linejoin: round;
  }
  .m.n {
    fill: #5b4a3a;
  }
  .m.s {
    fill: #b5532c;
  }
  .m.p {
    fill: var(--accent);
    filter: none;
  }
</style>
