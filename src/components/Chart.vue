<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import Icon from './Icon.vue'

export interface Series {
  name: string
  color: string
  values: (number | null)[]
  axis?: 'right'
  minStep?: number
  fmt?: (value: number) => string
}

const props = withDefaults(
  defineProps<{
    title: string
    icon?: string
    series: Series[]
    times: number[]
    max?: number
    fmt?: (v: number) => string
    loading?: boolean
    error?: string
    emptyText?: string
  }>(),
  {
    icon: undefined,
    max: undefined,
    fmt: (v: number) => v.toFixed(1),
    loading: false,
    error: '',
    emptyText: '这个时间段还没有记录哦……',
  },
)

const W = 600
const H = 160
const MAXPTS = 240
const TICK_INTERVALS = 4
const hoverIdx = ref<number | null>(null)
const box = ref<HTMLDivElement>()
const gradientId = useId()

watch(
  () => props.times,
  () => (hoverIdx.value = null),
)

const sampled = computed(() => {
  const n = props.times.length
  if (n <= MAXPTS) return { times: props.times, series: props.series.map((s) => s.values) }
  const k = n / MAXPTS
  const times: number[] = []
  const series = props.series.map(() => [] as (number | null)[])
  for (let b = 0; b < MAXPTS; b++) {
    const a = Math.floor(b * k)
    const e = Math.max(a + 1, Math.floor((b + 1) * k))
    times.push(props.times[Math.min(n - 1, e - 1)])
    props.series.forEach((s, si) => {
      let sum = 0
      let count = 0
      for (let i = a; i < e; i++) {
        const value = s.values[i]
        if (typeof value === 'number' && Number.isFinite(value)) {
          sum += value
          count++
        }
      }
      series[si].push(count ? sum / count : null)
    })
  }
  return { times, series }
})

const rightSeries = computed(() => props.series.find((series) => series.axis === 'right'))

function axisTop(right: boolean) {
  let m = 0
  sampled.value.series.forEach((values, i) => {
    if ((props.series[i].axis === 'right') !== right) return
    for (const value of values) {
      if (typeof value === 'number' && Number.isFinite(value) && value > m) m = value
    }
  })
  const minStep = right ? (rightSeries.value?.minStep ?? 1) : 1
  const increment = minStep * TICK_INTERVALS
  return Math.ceil((m > 0 ? m * 1.15 : increment) / increment) * increment
}

const top = computed(() => props.max || axisTop(false))
const rightTop = computed(() => axisTop(true))
const tickFractions = Array.from({ length: TICK_INTERVALS + 1 }, (_, i) => 1 - i / TICK_INTERVALS)
const leftTicks = computed(() => tickFractions.map((fraction) => props.fmt(top.value * fraction)))
const rightTicks = computed(() => tickFractions.map((fraction) => (rightSeries.value?.fmt || props.fmt)(rightTop.value * fraction)))

function xAt(i: number) {
  const times = sampled.value.times
  const span = times[times.length - 1] - times[0]
  return span > 0 ? ((times[i] - times[0]) / span) * W : W / 2
}

function yAt(value: number, scale = top.value) {
  return H - 8 - (Math.max(0, value) / scale) * (H - 16)
}

function pathFor(values: (number | null)[], area: boolean, scale: number) {
  const segments: { x: number; y: number }[][] = []
  let points: { x: number; y: number }[] = []
  values.forEach((value, i) => {
    if (value === null || !Number.isFinite(value)) {
      if (points.length) segments.push(points)
      points = []
      return
    }
    points.push({ x: xAt(i), y: yAt(value, scale) })
  })
  if (points.length) segments.push(points)
  return segments.map((segment) => {
    const first = segment[0]
    const last = segment[segment.length - 1]
    let d = segment.map((point, i) => `${i === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ')
    if (segment.length === 1) d += ` L${first.x},${first.y}`
    if (area) d += ` L${last.x},${H} L${first.x},${H} Z`
    return d
  }).join(' ')
}

const paths = computed(() =>
  sampled.value.series.map((vals, i) => {
    const scale = props.series[i].axis === 'right' ? rightTop.value : top.value
    return {
      line: pathFor(vals, false, scale),
      area: pathFor(vals, true, scale),
      color: props.series[i].color,
      id: `${gradientId}-${i}`,
    }
  }),
)

function formatValue(value: number | null | undefined, series: Series) {
  return typeof value === 'number' && Number.isFinite(value) ? (series.fmt || props.fmt)(value) : '—'
}

function onMove(e: PointerEvent) {
  const el = box.value
  const n = sampled.value.times.length
  if (!el || !n) return
  const r = el.getBoundingClientRect()
  const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
  const times = sampled.value.times
  const target = times[0] + f * (times[n - 1] - times[0])
  let nearest = 0
  for (let i = 1; i < n; i++) {
    if (Math.abs(times[i] - target) < Math.abs(times[nearest] - target)) nearest = i
  }
  hoverIdx.value = nearest
}

function timeLabel(value: number) {
  const t = new Date(value)
  const times = sampled.value.times
  const shortRange = times[times.length - 1] - times[0] <= 10 * 60000
  const label = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
  return shortRange ? `${label}:${String(t.getSeconds()).padStart(2, '0')}` : label
}

const timeTicks = computed(() => {
  const times = sampled.value.times
  if (!times.length) return []
  const first = times[0]
  const last = times[times.length - 1]
  if (first === last) return [timeLabel(first)]
  return [timeLabel(first), timeLabel((first + last) / 2), timeLabel(last)]
})

const tip = computed(() => {
  const i = hoverIdx.value
  if (i === null || i >= sampled.value.times.length) return null
  return {
    left: (xAt(i) / W) * 100,
    time: new Date(sampled.value.times[i]).toLocaleString('zh-CN', { hour12: false }),
    rows: props.series.map((s, si) => ({ name: s.name, color: s.color, v: formatValue(sampled.value.series[si][i], s) })),
  }
})

const latest = computed(() =>
  props.series.map((s) => {
    let value: number | null = null
    for (let i = s.values.length - 1; i >= 0 && value === null; i--) {
      const v = s.values[i]
      if (typeof v === 'number' && Number.isFinite(v)) value = v
    }
    return { name: s.name, color: s.color, v: formatValue(value, s) }
  }),
)

const emptyMessage = computed(() => {
  if (props.loading) return '正在打捞记录……'
  if (props.error) return '记录加载失败，请重试'
  return props.emptyText
})
</script>

<template>
  <section class="chart" :aria-label="`${title}历史记录`" :aria-busy="loading">
    <div class="chart-head">
      <h3 class="chart-title"><Icon v-if="icon" :name="icon" size="18px" />{{ title }}</h3>
      <div class="chart-legend" aria-label="最近一条记录">
        <span v-for="l in latest" :key="l.name" class="chip"><i :style="{ background: l.color }" />{{ l.name }} <b>{{ l.v }}</b></span>
      </div>
    </div>
    <div class="chart-axes" :class="{ 'has-right': rightSeries }">
      <div class="y-axis" :aria-label="`${title} Y 轴刻度`">
        <span v-for="(tick, i) in leftTicks" :key="i">{{ tick }}</span>
      </div>
      <div ref="box" class="plot" @pointermove="onMove" @pointerleave="hoverIdx = null">
        <svg class="plot-svg" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient v-for="p in paths" :id="p.id" :key="p.id" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" :stop-color="p.color" stop-opacity="0.45" />
              <stop offset="100%" :stop-color="p.color" stop-opacity="0.04" />
            </linearGradient>
          </defs>
          <line v-for="fraction in tickFractions" :key="fraction" x1="0" :x2="W" :y1="yAt(top * fraction)" :y2="yAt(top * fraction)" class="plot-grid" />
          <g v-for="p in paths" :key="p.id">
            <path :d="p.area" :fill="`url(#${p.id})`" />
            <path :d="p.line" class="halo" />
            <path :d="p.line" class="line" :stroke="p.color" />
          </g>
        </svg>
        <div v-if="!times.length" class="chart-empty" role="status">{{ emptyMessage }}</div>
        <template v-if="tip">
          <div class="cursor" :style="{ left: `${tip.left}%` }" />
          <div class="tip" :style="{ '--tip-x': `${tip.left}%` }">
            <div class="tip-t">{{ tip.time }}</div>
            <div v-for="r in tip.rows" :key="r.name"><i :style="{ background: r.color }" />{{ r.name }} {{ r.v }}</div>
          </div>
        </template>
      </div>
      <div v-if="rightSeries" class="y-axis right" :style="{ color: rightSeries.color }" :aria-label="`${rightSeries.name} Y 轴刻度`">
        <span v-for="(tick, i) in rightTicks" :key="i">{{ tick }}</span>
      </div>
      <div class="time-axis" :class="{ single: timeTicks.length === 1 }" aria-label="记录时间">
        <span v-for="(tick, i) in timeTicks" :key="i">{{ tick }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.chart {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 12px 14px 10px;
  background: var(--paper);
  border: 2.5px solid var(--ink);
  border-radius: 18px;
  box-shadow: 0 4px 0 var(--ink);
}
.chart-head {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 40px;
  margin-bottom: 10px;
  font-size: 13px;
}
.chart-title {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  white-space: nowrap;
}
.chart-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 4px 14px;
  min-height: 18px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  line-height: 18px;
  white-space: nowrap;
  color: var(--muted);
  font-family: Fredoka, 'Microsoft YaHei UI', sans-serif;
}
.chip b {
  color: var(--text);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.chip i,
.tip i {
  display: inline-block;
  width: 9px;
  height: 9px;
  flex: none;
  border-radius: 50%;
  border: 1.5px solid var(--ink);
}
.chart-axes {
  flex: 1;
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  grid-template-rows: minmax(130px, 1fr) auto;
  column-gap: 8px;
}
.chart-axes.has-right {
  grid-template-columns: max-content minmax(0, 1fr) max-content;
}
.y-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 130px;
  padding-block: 2px;
  color: var(--muted);
  font-size: 10.5px;
  line-height: 12px;
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.y-axis.right {
  text-align: left;
}
.plot {
  min-width: 0;
  position: relative;
  min-height: 130px;
  background: var(--paper-2);
  border: 2px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  touch-action: pan-y;
}
.plot-svg {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}
.plot-grid {
  stroke: var(--line);
  stroke-dasharray: 4 6;
  vector-effect: non-scaling-stroke;
}
.halo {
  fill: none;
  stroke: var(--ink);
  stroke-width: 5;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
  opacity: 0.85;
}
.line {
  fill: none;
  stroke-width: 2.6;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}
.chart-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--muted);
  font-size: 13px;
  padding: 12px;
  text-align: center;
}
.time-axis {
  grid-column: 2;
  display: flex;
  justify-content: space-between;
  min-height: 14px;
  margin-top: 6px;
  padding: 0 2px;
  color: var(--muted);
  font-size: 10.5px;
  line-height: 14px;
  font-variant-numeric: tabular-nums;
}
.time-axis.single {
  justify-content: center;
}
.cursor {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  border-left: 2px dashed var(--ink);
  pointer-events: none;
}
.tip {
  position: absolute;
  top: 8px;
  left: clamp(6px, calc(var(--tip-x) + 10px), max(6px, calc(100% - 186px)));
  width: 180px;
  max-width: calc(100% - 12px);
  padding: 5px 9px;
  background: var(--paper);
  border: 2px solid var(--ink);
  border-radius: 10px;
  font-size: 12px;
  overflow-wrap: anywhere;
  pointer-events: none;
  font-family: Fredoka, 'Microsoft YaHei UI', sans-serif;
}
.tip-t {
  font-weight: 700;
}
.tip i {
  margin-right: 5px;
}
</style>
