<script lang="ts">
// Hand-drawn cartoon icons: chunky ink outline + ATRI palette. 32x32 grid.
function ring(n: number, r1: number, r2: number, perTooth = 4, rot = -Math.PI / 2) {
  const pts: string[] = []
  for (let i = 0; i < n * perTooth; i++) {
    const a = (i / (n * perTooth)) * Math.PI * 2 + rot
    const r = i % perTooth < perTooth / 2 ? r1 : r2
    pts.push(`${(16 + r * Math.cos(a)).toFixed(2)},${(16 + r * Math.sin(a)).toFixed(2)}`)
  }
  return `M${pts.join('L')}Z`
}

function rays(n: number, r1: number, r2: number) {
  let d = ''
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    d += `M${(16 + r1 * Math.cos(a)).toFixed(2)} ${(16 + r1 * Math.sin(a)).toFixed(2)}L${(16 + r2 * Math.cos(a)).toFixed(2)} ${(16 + r2 * Math.sin(a)).toFixed(2)}`
  }
  return d
}

const SPEAKER = '<path d="M4 12.5h5.5L17 6v20l-7.5-6.5H4z" fill="#fffaf0"/>'

export const ICONS: Record<string, string> = {
  sound: `${SPEAKER}<path d="M21 12c1.7 2.2 1.7 5.8 0 8M24.6 8.8c3.3 4 3.3 10.4 0 14.4" fill="none"/>`,
  mute: `${SPEAKER}<path d="M21 12.5l7 7M28 12.5l-7 7" fill="none" stroke="var(--ribbon)" stroke-width="3.2"/>`,
  sun: `<path d="${rays(8, 11.5, 14.6)}" stroke-width="2.6"/>
    <circle cx="16" cy="16" r="8.2" fill="#ffd84a"/>
    <circle cx="13.3" cy="15" r="1.15" fill="#4a2c1a" stroke="none"/><circle cx="18.7" cy="15" r="1.15" fill="#4a2c1a" stroke="none"/>
    <path d="M13.6 18c1.3 1.3 3.5 1.3 4.8 0" fill="none" stroke="#4a2c1a" stroke-width="1.5"/>
    <ellipse cx="11.6" cy="17.9" rx="1.3" ry=".8" fill="#ff8aa0" stroke="none"/><ellipse cx="20.4" cy="17.9" rx="1.3" ry=".8" fill="#ff8aa0" stroke="none"/>`,
  moon: `<path d="M12.79 6.22A11 11 0 1 0 25.78 19.21A9.5 9.5 0 0 1 12.79 6.22Z" fill="#ffe680"/>
    <path d="M8.6 16.8c.9.9 2.3.9 3.2 0" fill="none" stroke="#4a2c1a" stroke-width="1.5"/>
    <ellipse cx="11.6" cy="20.2" rx="1.4" ry=".8" fill="#ff9aa8" stroke="none"/>
    <path d="M25 4.2l.9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9z" fill="#fff6c8" stroke-width="1.3"/>`,
  gear: `<path d="${ring(8, 14, 10.6)}" fill="#bfe3ff"/><circle cx="16" cy="16" r="4.2" fill="#fffaf0"/>`,
  pin: `<path d="M16 29.5c-1.3-3.2-8.2-8.6-8.2-15.3a8.2 8.2 0 0 1 16.4 0c0 6.7-6.9 12.1-8.2 15.3z" fill="var(--ribbon)"/>
    <circle cx="16" cy="14" r="3.3" fill="#fff"/>`,
  wave: `<path d="M3 15c2.5-3 5.5-3 8 0s5.5 3 8 0 5.5-3 8 0 2 2 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#4cc3ff"/>
    <path d="M7.5 21.5c1.5-1 3-1 4.5 0" fill="none" stroke="#fff" stroke-width="1.8"/>
    <circle cx="21" cy="8.5" r="2.2" fill="#fff" stroke-width="1.6"/><circle cx="25.5" cy="5" r="1.4" fill="#fff" stroke-width="1.4"/>`,
  gauge: `<path d="M3.5 22.5a12.5 12.5 0 0 1 25 0z" fill="#fffaf0"/>
    <path d="M7.6 20.5a8.6 8.6 0 0 1 3.4-6" fill="none" stroke="#3fd08f" stroke-width="2.8"/>
    <path d="M13.6 12.5a8.6 8.6 0 0 1 4.8 0" fill="none" stroke="#ffbf3c" stroke-width="2.8"/>
    <path d="M21 14.5a8.6 8.6 0 0 1 3.4 6" fill="none" stroke="#ff5468" stroke-width="2.8"/>
    <path d="M16 21.5l5-6.5" fill="none" stroke-width="2.6"/><circle cx="16" cy="21.5" r="2.5" fill="var(--ribbon)"/>`,
  clock: `<path d="M5.5 9.5a4.3 4.3 0 0 1 5.5-4.6M26.5 9.5a4.3 4.3 0 0 0-5.5-4.6" fill="none" stroke-width="2.6"/>
    <circle cx="16" cy="17" r="10.8" fill="#fffaf0"/>
    <path d="M16 11v6.5l4.2 2.6" fill="none" stroke-width="2.6"/>
    <path d="M10 27.5l-1.5 2M22 27.5l1.5 2" fill="none"/>`,
  up: `<path d="M16 3.5L27.5 16H21v10.5a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2V16H4.5z" fill="#ff8a5c"/>
    <path d="M14 9.5l-2.5 2.7" fill="none" stroke="#fff" stroke-width="1.8"/>`,
  down: `<path d="M16 28.5L27.5 16H21V5.5a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2V16H4.5z" fill="#3fd08f"/>
    <path d="M13.5 7v6" fill="none" stroke="#fff" stroke-width="1.8"/>`,
  right: `<path d="M28.5 16L16 4.5V11H5.5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2H16v6.5z" fill="#ffd84a"/>`,
  close: `<path d="M7.8 4.6L16 12.8l8.2-8.2 3.2 3.2-8.2 8.2 8.2 8.2-3.2 3.2-8.2-8.2-8.2 8.2-3.2-3.2 8.2-8.2-8.2-8.2z" fill="#fffaf0"/>`,
  star: `<path d="M16 2.5c1.3 7 4.8 10.4 13.5 13.5-8.7 3.1-12.2 6.5-13.5 13.5-1.3-7-4.8-10.4-13.5-13.5 8.7-3.1 12.2-6.5 13.5-13.5z" fill="#ffd84a"/>`,
  caret: `<path d="M6.5 9.5h19L16 23z" fill="var(--ribbon)"/>`,
  island: `<path d="M2.5 26.5c3-5 8.5-6.5 13.5-6.5s10.5 1.5 13.5 6.5z" fill="#ffe39a"/>
    <path d="M15.5 21.5c-.3-5 .8-9.4 3-12.3" fill="none" stroke-width="2.6"/>
    <path d="M18.5 9.2c-2.6-3.6-8-3.2-9.7.3 3.3-1 6.5-1 9.7-.3zM18.5 9.2c1.6-3.8 7-4.2 9.5-1.1-3.4-.6-6.4-.3-9.5 1.1zM18.5 9.2c-.6 3.6-3.6 6.6-7.2 7 .9-3.4 3.8-5.8 7.2-7zM18.5 9.2c3.6.6 6.6 3.6 7 7-3.4-.9-5.8-3.8-7-7z" fill="#7cd36a"/>`,
  chip: `<path d="M11 2.5v4.5M16 2.5v4.5M21 2.5v4.5M11 25v4.5M16 25v4.5M21 25v4.5M2.5 11h4.5M2.5 16h4.5M2.5 21h4.5M25 11h4.5M25 16h4.5M25 21h4.5" fill="none"/>
    <rect x="7" y="7" width="18" height="18" rx="3.6" fill="#4cc3ff"/><rect x="11.8" y="11.8" width="8.4" height="8.4" rx="1.6" fill="#fff"/>`,
  ram: `<path d="M6.5 22v4.5M10.5 22v4.5M14.5 22v4.5M18.5 22v4.5M22.5 22v4.5M26.5 22v4.5" fill="none" stroke-width="2"/>
    <rect x="3" y="8.5" width="26" height="14" rx="2.6" fill="#ff7aa8"/>
    <rect x="6.3" y="11.8" width="5" height="6.4" rx="1" fill="#fff" stroke-width="1.6"/>
    <rect x="13.5" y="11.8" width="5" height="6.4" rx="1" fill="#fff" stroke-width="1.6"/>
    <rect x="20.7" y="11.8" width="5" height="6.4" rx="1" fill="#fff" stroke-width="1.6"/>`,
  disk: `<rect x="4" y="4.5" width="24" height="23" rx="4.2" fill="#ffc94a"/>
    <circle cx="16" cy="14" r="5.8" fill="#fff"/><circle cx="16" cy="14" r="1.7" fill="#4a2c1a" stroke="none"/>
    <path d="M8.5 22.8h6.5" fill="none"/><circle cx="23.3" cy="22.8" r="1.5" fill="#3fd08f" stroke-width="1.3"/>`,
  swap: `<path d="M5.5 14.5A10.5 10.5 0 0 1 23.6 8.7L26 6.3v8.2h-8.2l2.8-2.8a6.4 6.4 0 0 0-10.9 2.8z" fill="#9b7bff"/>
    <path d="M26.5 17.5A10.5 10.5 0 0 1 8.4 23.3L6 25.7v-8.2h8.2l-2.8 2.8a6.4 6.4 0 0 0 10.9-2.8z" fill="#c9b8ff"/>`,
  link: `<g transform="rotate(-35 16 16)">
      <rect x="2.5" y="11" width="15.5" height="10" rx="5" fill="#4cc3ff"/><rect x="6.2" y="14.4" width="8" height="3.2" rx="1.6" fill="#fffaf0" stroke-width="1.6"/>
      <rect x="14" y="11" width="15.5" height="10" rx="5" fill="#ff7aa8"/><rect x="17.8" y="14.4" width="8" height="3.2" rx="1.6" fill="#fffaf0" stroke-width="1.6"/>
    </g>`,
  list: `<rect x="5" y="3.5" width="22" height="25" rx="3.6" fill="#fffaf0"/>
    <circle cx="10.2" cy="11" r="1.6" fill="#3fd08f" stroke-width="1.3"/><circle cx="10.2" cy="16.5" r="1.6" fill="#ffbf3c" stroke-width="1.3"/><circle cx="10.2" cy="22" r="1.6" fill="#4cc3ff" stroke-width="1.3"/>
    <path d="M14 11h8.5M14 16.5h8.5M14 22h6" fill="none" stroke-width="2.2"/>`,
  globe: `<circle cx="16" cy="16" r="12.8" fill="#4cc3ff"/>
    <path d="M8 8.6c3 .9 4.3 3.8 2.4 6.1-1.6 2 .8 4.8 3.6 4.9 3 .1 2.4 4.1.2 6.7C9 25 4.6 20.7 4.2 15.6 4 12.6 5.6 10.4 8 8.6z" fill="#a3df72" stroke-width="1.8"/>
    <path d="M18.6 4.4c3.5.4 7 2.8 8.8 6.4-2.4.7-4.4-.1-5.5-1.6s-3.4-1.9-3.3-4.8z" fill="#a3df72" stroke-width="1.8"/>
    <path d="M22 19c2.3-.8 4.4 0 5.2 1.4-.9 2.2-2.6 4.3-4.8 5.4-1.5-1.8-2.3-5.6-.4-6.8z" fill="#a3df72" stroke-width="1.8"/>
    <path d="M9 7.4a10 10 0 0 1 4.6-2.4" fill="none" stroke="#fff" stroke-width="2"/>`,
  anchor: `<circle cx="16" cy="6.6" r="3.2" fill="#ffd84a"/>
    <path d="M16 9.8V27.5M10.5 14h11" fill="none" stroke-width="2.8"/>
    <path d="M5 18.5c.4 6 5.2 9 11 9s10.6-3 11-9" fill="none" stroke-width="2.8"/>
    <path d="M2.8 20.3l2.2-3.8 2.8 3.4M29.2 20.3L27 16.5l-2.8 3.4" fill="none" stroke-width="2.4"/>`,
  sonar: `<circle cx="16" cy="16" r="12.8" fill="#bfe3ff"/>
    <circle cx="16" cy="16" r="7.6" fill="none" stroke-width="1.5" stroke-dasharray="2.2 2.6"/>
    <path d="M16 16L26.85 9.22A12.8 12.8 0 0 1 28.8 16Z" fill="#3fd08f" stroke-width="1.6"/>
    <circle cx="20.6" cy="21.4" r="1.9" fill="#ff7aa8" stroke-width="1.4"/>
    <circle cx="16" cy="16" r="2.2" fill="var(--ribbon)" stroke-width="1.6"/>`,
  heart: `<path d="M16 27.5C9.5 22.6 3.5 18 3.5 11.4 3.5 7.6 6.4 5 9.7 5c2.6 0 4.8 1.4 6.3 3.6C17.5 6.4 19.7 5 22.3 5c3.3 0 6.2 2.6 6.2 6.4 0 6.6-6 11.2-12.5 16.1z" fill="#ff7aa8"/>
    <path d="M8.5 9.6c.6-1.2 1.6-1.9 2.8-2" fill="none" stroke="#fff" stroke-width="1.8"/>`,
}
</script>

<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: string }>(), { size: '1.2em' })
</script>

<template>
  <svg
    class="ico"
    :width="size"
    :height="size"
    viewBox="0 0 32 32"
    aria-hidden="true"
    focusable="false"
    stroke="var(--ink)"
    stroke-width="2.2"
    stroke-linejoin="round"
    stroke-linecap="round"
    v-html="ICONS[name] || ''"
  />
</template>

<style scoped>
.ico {
  display: inline-block;
  flex: none;
  vertical-align: -0.22em;
  overflow: visible;
}
</style>
