<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { geoDistance, geoGraticule10, geoInterpolate, geoOrthographic, geoPath } from 'd3-geo'
import { feature, mesh } from 'topojson-client'
import worldUrl from 'world-atlas/countries-110m.json?url'
import crabUrl from '../assets/atri/crab.webp'
import type { GlobePoint } from '../types'
import Icon from './Icon.vue'

const props = defineProps<{
  points: GlobePoint[]
  dark: boolean
  speed: number
  routes: boolean
  focus: { lat: number; lon: number; seq: number } | null
}>()
const emit = defineEmits<{ select: [point: GlobePoint]; crab: [] }>()

const TAU = Math.PI * 2
const HALF = Math.PI / 2
const wrap = ref<HTMLDivElement>()
const canvas = ref<HTMLCanvasElement>()
const hover = ref<{ p: GlobePoint; x: number; y: number } | null>(null)
const loaded = ref(false)

let land: any = null
let borders: any = null
const graticule = geoGraticule10()
const proj = geoOrthographic().clipAngle(90).precision(0.5)
let size = 420
let dpr = 1
const rot: [number, number, number] = [-128, -24, 0]
let tweenFrom: [number, number] | null = null
let tweenTo: [number, number] | null = null
let tweenT = 0
let dragging = false
let moved = false
let lastX = 0
let lastY = 0
let downX = 0
let downY = 0
let idleUntil = 0
let raf = 0
let lastT = 0
let crabAngle = 0.8
let crabPos: { x: number; y: number; front: boolean } = { x: -99, y: -99, front: false }
let screenPins: { p: GlobePoint; x: number; y: number }[] = []
let ro: ResizeObserver | null = null
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const crabImg = new Image()
crabImg.src = crabUrl

function palette() {
  return props.dark
    ? {
        ring: '#d7e4ff',
        ink: '#0a1630',
        ocean: ['#5c9be0', '#1f5299', '#0c2955'],
        land: '#62b27a',
        coast: '#e3d496',
        border: 'rgba(8,40,26,.35)',
        grat: 'rgba(255,255,255,.10)',
        route: '#ffd36b',
        shade: 'rgba(2,8,30,.5)',
        shine: 'rgba(255,255,255,.35)',
        label: '#1e2f52',
        labelText: '#f4ead6',
      }
    : {
        ring: '#ffffff',
        ink: '#4a2c1a',
        ocean: ['#b3f0ff', '#48bbef', '#1d7cc8'],
        land: '#a3df72',
        coast: '#ffe49c',
        border: 'rgba(58,96,36,.38)',
        grat: 'rgba(255,255,255,.3)',
        route: '#ff5d73',
        shade: 'rgba(8,36,92,.3)',
        shine: 'rgba(255,255,255,.6)',
        label: '#fffaf0',
        labelText: '#4a2c1a',
      }
}

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return (h % 1000) / 159
}

function resize() {
  const el = wrap.value
  const cv = canvas.value
  if (!el || !cv) return
  size = Math.max(240, Math.floor(el.clientWidth))
  dpr = Math.min(2.5, window.devicePixelRatio || 1)
  cv.width = Math.round(size * dpr)
  cv.height = Math.round(size * dpr)
  cv.style.width = `${size}px`
  cv.style.height = `${size}px`
}

function geom() {
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - Math.max(30, size * 0.1)
  return { cx, cy, r }
}

function drawPin(ctx: CanvasRenderingContext2D, x: number, y: number, fill: string, dot: string, ink: string, s: number) {
  const R = 8.5 * s
  const hy = y - 19 * s
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.bezierCurveTo(x - 2 * s, y - 6 * s, x - R, hy + 7 * s, x - R, hy)
  ctx.arc(x, hy, R, Math.PI, 0)
  ctx.bezierCurveTo(x + R, hy + 7 * s, x + 2 * s, y - 6 * s, x, y)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 2.2
  ctx.strokeStyle = ink
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x, hy, 3.8 * s, 0, TAU)
  ctx.fillStyle = dot
  ctx.fill()
  ctx.lineWidth = 1.6
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(x - R * 0.45, hy - R * 0.45, R * 0.28, R * 0.16, -0.7, 0, TAU)
  ctx.fillStyle = 'rgba(255,255,255,.7)'
  ctx.fill()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function orbit(cx: number, cy: number, r: number) {
  const rx = r + size * 0.065
  const ry = rx * 0.3
  const tilt = -0.3
  return { rx, ry, tilt }
}

function drawCrab(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, front: boolean, now: number, ink: string) {
  const { rx, ry, tilt } = orbit(cx, cy, r)
  // half of the orbit ring
  ctx.save()
  ctx.setLineDash([4, 6])
  ctx.lineWidth = 1.5
  ctx.strokeStyle = props.dark ? 'rgba(215,228,255,.35)' : 'rgba(74,44,26,.25)'
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, tilt, front ? 0 : Math.PI, front ? Math.PI : TAU)
  ctx.stroke()
  ctx.restore()
  const ex = Math.cos(crabAngle) * rx
  const ey = Math.sin(crabAngle) * ry
  const x = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt)
  const y = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt)
  const isFront = Math.sin(crabAngle) > 0
  if (isFront !== front) return
  crabPos = { x, y, front: isFront }
  if (!crabImg.complete || !crabImg.naturalWidth) return
  const depth = 0.72 + 0.28 * Math.sin(crabAngle)
  const w = size * 0.1 * depth
  const h = (w * crabImg.naturalHeight) / crabImg.naturalWidth
  ctx.save()
  ctx.globalAlpha = front ? 1 : 0.55
  ctx.translate(x, y)
  ctx.rotate(Math.sin(now / 180) * 0.12)
  ctx.drawImage(crabImg, -w / 2, -h / 2, w, h)
  ctx.restore()
  void ink
}

function draw(now: number) {
  const cv = canvas.value
  if (!cv) return
  const ctx = cv.getContext('2d')
  if (!ctx) return
  const c = palette()
  const { cx, cy, r } = geom()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, size, size)
  proj.scale(r).translate([cx, cy]).rotate(rot)
  const path = geoPath(proj, ctx)
  const center: [number, number] = [-rot[0], -rot[1]]

  drawCrab(ctx, cx, cy, r, false, now, c.ink)

  // sticker rim
  ctx.beginPath()
  ctx.arc(cx, cy, r + 7, 0, TAU)
  ctx.fillStyle = c.ring
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = c.ink
  ctx.stroke()

  // ocean
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r)
  g.addColorStop(0, c.ocean[0])
  g.addColorStop(0.55, c.ocean[1])
  g.addColorStop(1, c.ocean[2])
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, TAU)
  ctx.fillStyle = g
  ctx.fill()

  ctx.beginPath()
  path(graticule)
  ctx.lineWidth = 1
  ctx.strokeStyle = c.grat
  ctx.stroke()

  if (land) {
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    path(land)
    ctx.lineWidth = Math.max(4, r * 0.03)
    ctx.strokeStyle = c.coast
    ctx.stroke()
    ctx.fillStyle = c.land
    ctx.fill()
    ctx.beginPath()
    path(borders)
    ctx.lineWidth = 0.8
    ctx.strokeStyle = c.border
    ctx.stroke()
    ctx.beginPath()
    path(land)
    ctx.lineWidth = 1.6
    ctx.strokeStyle = c.ink
    ctx.stroke()
  }

  // cartoon shading + shine
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, TAU)
  ctx.clip()
  const sh = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.55, cx, cy, r * 1.05)
  sh.addColorStop(0, 'rgba(0,0,0,0)')
  sh.addColorStop(1, c.shade)
  ctx.fillStyle = sh
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  ctx.beginPath()
  ctx.ellipse(cx - r * 0.45, cy - r * 0.5, r * 0.24, r * 0.1, -0.75, 0, TAU)
  ctx.fillStyle = c.shine
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx - r * 0.16, cy - r * 0.7, r * 0.035, 0, TAU)
  ctx.fill()
  ctx.restore()

  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, TAU)
  ctx.lineWidth = 3
  ctx.strokeStyle = c.ink
  ctx.stroke()

  const pts = props.points

  // routes between cities
  if (props.routes && pts.length > 1) {
    const pairs: [GlobePoint, GlobePoint][] = []
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) pairs.push([pts[i], pts[j]])
    pairs.slice(0, 15).forEach(([a, b], idx) => {
      const A: [number, number] = [a.lon, a.lat]
      const B: [number, number] = [b.lon, b.lat]
      const dist = geoDistance(A, B)
      if (dist < 0.01) return
      const interp = geoInterpolate(A, B)
      const lift = Math.min(0.32, 0.06 + dist * 0.22)
      const N = 48
      const xy: ([number, number] | null)[] = []
      for (let i = 0; i <= N; i++) {
        const ll = interp(i / N)
        if (geoDistance(ll, center) > HALF - 0.02) {
          xy.push(null)
          continue
        }
        const p = proj(ll)!
        const k = 1 + lift * Math.sin((Math.PI * i) / N)
        xy.push([cx + (p[0] - cx) * k, cy + (p[1] - cy) * k])
      }
      const stroke = (w: number, col: string) => {
        ctx.beginPath()
        let pen = false
        for (const p of xy) {
          if (!p) {
            pen = false
            continue
          }
          if (pen) ctx.lineTo(p[0], p[1])
          else ctx.moveTo(p[0], p[1])
          pen = true
        }
        ctx.lineWidth = w
        ctx.strokeStyle = col
        ctx.stroke()
      }
      ctx.save()
      ctx.setLineDash([7, 7])
      ctx.lineDashOffset = -now * 0.03
      stroke(5, c.ink)
      stroke(2.6, c.route)
      ctx.restore()
      const ph = ((now / 2600 + idx * 0.37) % 1) * N
      const p = xy[Math.round(ph)]
      if (p) {
        ctx.beginPath()
        ctx.arc(p[0], p[1], 4, 0, TAU)
        ctx.fillStyle = '#fff'
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = c.ink
        ctx.stroke()
      }
    })
  }

  // pins
  const vis: { p: GlobePoint; x: number; y: number; a: number }[] = []
  for (const p of pts) {
    const ll: [number, number] = [p.lon, p.lat]
    const d = geoDistance(ll, center)
    if (d > HALF - 0.05) continue
    const a = Math.min(1, (HALF - 0.05 - d) / 0.25)
    const [x, y] = proj(ll)!
    vis.push({ p, x, y, a })
  }
  screenPins = []
  const showLabels = vis.length <= 8
  ctx.font = '600 12px Fredoka, "Microsoft YaHei UI", "PingFang SC", sans-serif'
  for (const { p, x, y, a } of vis) {
    const anyOn = p.nodes.some((n) => n.online)
    const allOn = p.nodes.every((n) => n.online)
    const st = allOn ? '#35dc95' : anyOn ? '#ffbe3a' : '#9aa3b5'
    const isHover = hover.value?.p.key === p.key
    const s = isHover ? 1.25 : 1
    const bob = reduced ? 0 : Math.sin(now / 420 + hash(p.key)) * 2
    ctx.globalAlpha = a
    if (anyOn) {
      for (let k = 0; k < 2; k++) {
        const ph = (now / 1700 + k * 0.5) % 1
        const rr = 6 + ph * 24
        ctx.beginPath()
        ctx.ellipse(x, y, rr, rr * 0.55, 0, 0, TAU)
        ctx.lineWidth = 2.2
        ctx.strokeStyle = st
        ctx.globalAlpha = a * (1 - ph)
        ctx.stroke()
      }
      ctx.globalAlpha = a
    }
    ctx.beginPath()
    ctx.ellipse(x, y, 6, 2.6, 0, 0, TAU)
    ctx.fillStyle = 'rgba(0,0,0,.28)'
    ctx.fill()
    drawPin(ctx, x, y - bob, anyOn ? '#ff4d5e' : '#a7adbb', st, c.ink, s)
    if (p.nodes.length > 1) {
      const bx = x + 9 * s
      const by = y - bob - 28 * s
      ctx.beginPath()
      ctx.arc(bx, by, 7.5, 0, TAU)
      ctx.fillStyle = '#ffd84a'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = c.ink
      ctx.stroke()
      ctx.fillStyle = '#4a2c1a'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = '700 10px Fredoka, sans-serif'
      ctx.fillText(String(p.nodes.length), bx, by + 0.5)
      ctx.font = '600 12px Fredoka, "Microsoft YaHei UI", "PingFang SC", sans-serif'
    }
    if (showLabels || isHover) {
      const text = p.label
      const tw = ctx.measureText(text).width
      const lx = x + 14 * s
      const ly = y - bob - 19 * s
      roundRect(ctx, lx, ly - 10, tw + 14, 20, 10)
      ctx.fillStyle = c.label
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = c.ink
      ctx.stroke()
      ctx.fillStyle = c.labelText
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, lx + 7, ly + 0.5)
    }
    screenPins.push({ p, x, y: y - bob - 18 * s })
  }
  ctx.globalAlpha = 1

  drawCrab(ctx, cx, cy, r, true, now, c.ink)
}

function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function frame(now: number) {
  const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0
  lastT = now
  if (tweenTo && tweenFrom) {
    tweenT = Math.min(1, tweenT + dt / 1.2)
    const e = ease(tweenT)
    rot[0] = tweenFrom[0] + (tweenTo[0] - tweenFrom[0]) * e
    rot[1] = tweenFrom[1] + (tweenTo[1] - tweenFrom[1]) * e
    if (tweenT >= 1) {
      tweenTo = null
      idleUntil = now + 5000
    }
  } else if (!dragging && !hover.value && now > idleUntil) {
    rot[0] += (reduced ? 0.3 : 1) * props.speed * dt
  }
  if (!reduced) crabAngle += dt * 0.55
  draw(now)
  raf = requestAnimationFrame(frame)
}

function local(e: PointerEvent) {
  const rect = canvas.value!.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function hitPin(x: number, y: number) {
  let best: { p: GlobePoint; x: number; y: number } | null = null
  let bd = 20
  for (const sp of screenPins) {
    const d = Math.hypot(sp.x - x, sp.y - y)
    if (d < bd) {
      bd = d
      best = sp
    }
  }
  return best
}

function onDown(e: PointerEvent) {
  dragging = true
  moved = false
  downX = lastX = e.clientX
  downY = lastY = e.clientY
  tweenTo = null
  canvas.value?.setPointerCapture(e.pointerId)
}

function onMove(e: PointerEvent) {
  if (dragging) {
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 4) moved = true
    if (!moved) return
    const k = 180 / (Math.PI * geom().r)
    rot[0] += dx * k
    rot[1] = Math.max(-70, Math.min(70, rot[1] - dy * k))
    hover.value = null
    return
  }
  const { x, y } = local(e)
  const hit = hitPin(x, y)
  hover.value = hit
  const crabHit = crabPos.front && Math.hypot(crabPos.x - x, crabPos.y - y) < size * 0.05
  canvas.value!.style.cursor = hit || crabHit ? 'pointer' : 'grab'
}

function onUp(e: PointerEvent) {
  if (dragging && !moved) {
    const { x, y } = local(e)
    const hit = hitPin(x, y)
    if (hit) emit('select', hit.p)
    else if (crabPos.front && Math.hypot(crabPos.x - x, crabPos.y - y) < size * 0.05) emit('crab')
  }
  dragging = false
  idleUntil = performance.now() + 2500
}

function onLeave() {
  if (!dragging) hover.value = null
}

watch(
  () => props.focus?.seq,
  () => {
    const f = props.focus
    if (!f) return
    const tx = -f.lon
    const ty = Math.max(-55, Math.min(55, -f.lat))
    const dl = ((((tx - rot[0]) % 360) + 540) % 360) - 180
    tweenFrom = [rot[0], rot[1]]
    tweenTo = [rot[0] + dl, ty]
    tweenT = 0
  },
)

onMounted(async () => {
  resize()
  ro = new ResizeObserver(resize)
  if (wrap.value) ro.observe(wrap.value)
  raf = requestAnimationFrame(frame)
  try {
    const topo = await (await fetch(worldUrl)).json()
    land = feature(topo, topo.objects.land)
    borders = mesh(topo, topo.objects.countries, (a: unknown, b: unknown) => a !== b)
  } catch {
    /* globe still renders as an ocean */
  }
  loaded.value = true
  if (import.meta.env.DEV) (window as any).__globe = { rot, pins: () => screenPins, size: () => size }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
})
</script>

<template>
  <div ref="wrap" class="globe" :class="{ loaded }">
    <canvas
      ref="canvas"
      class="globe-canvas"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @pointerleave="onLeave"
    />
    <div v-if="hover" class="globe-tip" :style="{ left: `${hover.x}px`, top: `${hover.y}px` }">
      <div class="globe-tip-title"><Icon name="pin" size="18px" />{{ hover.p.label }}</div>
      <div v-for="n in hover.p.nodes" :key="n.uuid" class="globe-tip-row">
        <i :class="n.online ? 'on' : 'off'" />{{ n.name }}
      </div>
      <div class="globe-tip-hint">点击查看 Log</div>
    </div>
  </div>
</template>

<style scoped>
.globe {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  opacity: 0;
  transform: scale(0.92);
  transition:
    opacity 0.6s ease,
    transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.globe.loaded {
  opacity: 1;
  transform: none;
}
.globe-canvas {
  display: block;
  cursor: grab;
  touch-action: pan-y;
}
.globe-canvas:active {
  cursor: grabbing;
}
.globe-tip {
  position: absolute;
  transform: translate(-50%, calc(-100% - 14px));
  min-width: 140px;
  max-width: 240px;
  padding: 8px 12px;
  background: var(--paper);
  color: var(--text);
  border: 2.5px solid var(--ink);
  border-radius: 14px;
  box-shadow: 0 4px 0 var(--ink);
  pointer-events: none;
  font-size: 13px;
  z-index: 5;
  white-space: nowrap;
}
.globe-tip::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -9px;
  width: 14px;
  height: 14px;
  background: var(--paper);
  border-right: 2.5px solid var(--ink);
  border-bottom: 2.5px solid var(--ink);
  transform: translateX(-50%) rotate(45deg);
}
.globe-tip-title {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 700;
  margin-bottom: 4px;
}
.globe-tip-row {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.globe-tip-row i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid var(--ink);
  flex: none;
}
.globe-tip-row i.on {
  background: var(--ok);
}
.globe-tip-row i.off {
  background: #9aa3b5;
}
.globe-tip-hint {
  margin-top: 4px;
  font-size: 11px;
  color: var(--muted);
}
</style>
