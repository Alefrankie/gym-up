<script lang="ts" module>
  /** One stroke family (1.8 px, round caps) on a 24 px grid. Every name below is a drawn path set. */
  const PATHS = {
    home: 'M3.5 11 12 4l8.5 7M5.5 9.7V20h4.5v-5.5h4V20h4.5V9.7',
    dumbbell: 'M2.8 10h1.7v4H2.8ZM4.5 8h2.6v8H4.5ZM16.9 8h2.6v8h-2.6ZM19.5 10h1.7v4h-1.7ZM7.1 12h9.8',
    chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    users: 'M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11ZM3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16.5 5a3 3 0 0 1 0 6M18 14.8c2 .6 3.5 2.3 3.5 5.2',
    more: 'M5 10.7a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6ZM12 10.7a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6ZM19 10.7a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Z',
    plus: 'M12 5v14M5 12h14',
    check: 'm5 12.5 4.5 4.5L19 7.5',
    right: 'm9.5 5 7 7-7 7',
    left: 'm14.5 5-7 7 7 7',
    edit: 'm4 20 1-4.2L16.3 4.5a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.2 19 4 20ZM14.5 6.3l3.2 3.2',
    trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7M10 11v5M14 11v5',
    up: 'm6 14 6-6 6 6',
    down: 'm6 10 6 6 6-6',
    x: 'M6 6l12 12M18 6 6 18',
    flame: 'M12 3c.6 3.2 4.5 5 4.5 9.6A4.5 4.5 0 0 1 12 17a4.5 4.5 0 0 1-4.5-4.4c0-1.7.8-2.8 1.6-3.6.3 1.3 1 2 1.8 2.2C10.5 8.4 11 5.6 12 3ZM9 20.5h6',
    timer: 'M12 8v4.5l3 1.8M9 2.5h6M12 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z',
    camera: 'M4 8.5h3.2L8.7 6h6.6l1.5 2.5H20V19H4V8.5ZM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
    sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',
    history: 'M4 12a8 8 0 1 0 2.6-5.9L4 8.5M4 4v4.5h4.5M12 8v4.2l2.8 1.8',
    utensils: 'M7 3v7.5a2 2 0 0 0 2 2v8.5M7 3v5M11 3v5M7 8h4M16.5 21V3c-2 1-3.5 3.5-3.5 7 0 1.8 1.4 3 3.5 3',
    search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM15.5 15.5 20 20',
    book: 'M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3V4.5ZM5 17a3 3 0 0 1 3-3h10',
    logout: 'M10 4.5H5.5v15H10M14 8l4 4-4 4M18 12H9',
    bolt: 'M13 3 5.5 13.5H12L11 21l7.5-10.5H12L13 3Z',
    copy: 'M9 9h10v11H9V9ZM15 9V4H5v11h4',
    share: 'M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
    qr: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM19 14v2M14 19h2M19 19h2v2',
    key: 'M14.5 9.5a4 4 0 1 1-1 2.6L4 20v-3h3v-2.5h2.5L12 12',
    eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 14.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z',
    eyeOff: 'M4 4l16 16M9.9 5.8A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a15 15 0 0 1-2.9 3.5M6.3 7.6A15 15 0 0 0 2.5 12S6 18.5 12 18.5c1.5 0 2.8-.4 4-.9M10.2 10.2a2.8 2.8 0 0 0 3.6 3.6',
    alert: 'M12 4 2.8 19.5h18.4L12 4ZM12 10v4.2M12 16.8v.2',
    swap: 'M7 7h11M15 4l3 3-3 3M17 17H6M9 14l-3 3 3 3',
    cloud: 'M7 18a4.5 4.5 0 0 1-.4-9 6 6 0 0 1 11.6 1.5A3.8 3.8 0 0 1 17.5 18H7Z',
    mic: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3ZM19 11a7 7 0 0 1-14 0M12 18v4M9 22h6',
    stop: 'M7 7h10v10H7z',
  } as const;
  export type IconName = keyof typeof PATHS;
  export { PATHS };
</script>

<script lang="ts">
  let { name, size = 24, label }: { name: IconName; size?: number; label?: string } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
>
  <path d={PATHS[name]} />
</svg>
