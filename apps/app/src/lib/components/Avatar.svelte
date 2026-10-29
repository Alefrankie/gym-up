<script lang="ts">
  let { name, size = 36 }: { name: string; size?: number } = $props();

  // Warm, distinct tones from the palette; the same name always lands on the same one.
  const TONES: Array<[string, string]> = [
    ['#ff8450', '#d9501a'],
    ['#ffc56b', '#e0932a'],
    ['#b7dd8e', '#6ea245'],
    ['#f08a8a', '#c4504f'],
    ['#e6c9a0', '#a8845a'],
  ];
  const tone = $derived(TONES[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TONES.length]!);
  const initials = $derived(
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?',
  );
</script>

<span class="avatar" style={`--a:${tone[0]};--b:${tone[1]};--s:${size}px`} aria-hidden="true">{initials}</span>

<style>
  .avatar {
    flex: none;
    display: inline-grid;
    place-items: center;
    width: var(--s);
    height: var(--s);
    border-radius: 50%;
    background: color-mix(in srgb, var(--a) 16%, transparent);
    color: var(--a);
    font-weight: 600;
    font-size: calc(var(--s) * 0.38);
    line-height: 1;
  }
</style>
