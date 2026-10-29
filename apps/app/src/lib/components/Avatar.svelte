<script lang="ts">
  let { name, size = 44 }: { name: string; size?: number } = $props();

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
    background: linear-gradient(160deg, var(--a), var(--b));
    box-shadow:
      0 1px 0 rgb(255 255 255 / 0.4) inset,
      0 6px 12px -6px rgb(0 0 0 / 0.7);
    color: #1c0d05;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: calc(var(--s) * 0.42);
    letter-spacing: 0.02em;
  }
</style>
