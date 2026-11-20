import type { PingRecord, PingStat, PingTask } from './api'

export const PING_COLORS = ['#4cc3ff', '#ff7aa8', '#3fd08f', '#ffc94a', '#9b7bff', '#ff8a5c']
const MAX_POINTS = 240
const MAX_BEATS = 48

export type Level = 'ok' | 'warn' | 'bad'
export const latencyLevel = (ms: number): Level => (ms <= 100 ? 'ok' : ms <= 200 ? 'warn' : 'bad')
export const lossLevel = (pct: number): Level => (pct <= 0 ? 'ok' : pct < 10 ? 'warn' : 'bad')
export const ms = (v: number | null | undefined) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? `${Math.round(v)} ms` : '—'
export const lossText = (pct: number) => `${pct >= 10 || pct === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`

export interface Beat {
  from: number
  to: number
  total: number
  lost: number
  avg: number | null
  level: Level | 'none'
}

export interface PingLine {
  id: number
  name: string
  type: string
  color: string
  values: (number | null)[]
  beats: Beat[]
  latest: number | null
  avg: number | null
  min: number | null
  max: number | null
  loss: number
  total: number
}

interface Sample {
  t: number
  v: number
}

const byTime = (a: Sample, b: Sample) => a.t - b.t
/** Admin-configured task order (the official frontend sorts the same way). */
export const byWeight = (a: PingTask, b: PingTask) => (a.weight ?? 0) - (b.weight ?? 0) || a.id - b.id

function groupByTask(records: PingRecord[]) {
  const out = new Map<number, Sample[]>()
  for (const r of records) {
    const t = Date.parse(r.time)
    if (!Number.isFinite(t)) continue
    let list = out.get(r.task_id)
    if (!list) out.set(r.task_id, (list = []))
    list.push({ t, v: r.value })
  }
  for (const list of out.values()) list.sort(byTime)
  return out
}

function stats(samples: Sample[]) {
  let lost = 0
  let sum = 0
  let min = Infinity
  let max = -Infinity
  let latest: number | null = null
  for (const s of samples) {
    if (s.v < 0) {
      lost++
      continue
    }
    sum += s.v
    min = Math.min(min, s.v)
    max = Math.max(max, s.v)
    latest = s.v
  }
  const valid = samples.length - lost
  return {
    total: samples.length,
    loss: samples.length ? (lost / samples.length) * 100 : 0,
    avg: valid ? sum / valid : null,
    min: valid ? min : null,
    max: valid ? max : null,
    latest,
  }
}

/**
 * Aligns every task onto one shared time grid for the chart. Buckets that only saw lost
 * probes stay empty so the line breaks there; short empty stretches caused by report
 * jitter or slower tasks are interpolated so the line does not turn into dots.
 */
export function buildPingLines(records: PingRecord[], tasks: PingTask[], hours: number) {
  const grouped = groupByTask(records)
  const known = new Map(tasks.map((t) => [t.id, t]))
  if (tasks.length) {
    // records of tasks since deleted or unassigned linger until retention expires; skip them
    for (const id of [...grouped.keys()]) if (!known.has(id)) grouped.delete(id)
  } else {
    for (const id of grouped.keys()) known.set(id, { id, name: `任务 ${id}`, type: '', interval: 60 })
  }
  const list = [...known.values()].sort(byWeight)

  let first = Infinity
  let last = -Infinity
  for (const samples of grouped.values()) {
    if (!samples.length) continue
    first = Math.min(first, samples[0].t)
    last = Math.max(last, samples[samples.length - 1].t)
  }

  const maxInterval = Math.max(10, ...list.map((t) => t.interval || 60))
  const bucket = Math.max(maxInterval * 1000, Math.ceil((hours * 3600000) / MAX_POINTS / 1000) * 1000)
  const has = Number.isFinite(first)
  const k0 = has ? Math.floor(first / bucket) : 0
  const n = has ? Math.floor(last / bucket) - k0 + 1 : 0
  const times = Array.from({ length: n }, (_, i) => Math.min((k0 + i) * bucket + bucket / 2, last))

  const lines: PingLine[] = list.map((task, ti) => {
    const samples = grouped.get(task.id) || []
    const sum = new Float64Array(n)
    const ok = new Uint32Array(n)
    const lost = new Uint32Array(n)
    for (const s of samples) {
      const i = Math.floor(s.t / bucket) - k0
      if (i < 0 || i >= n) continue
      if (s.v < 0) lost[i]++
      else {
        sum[i] += s.v
        ok[i]++
      }
    }
    const values: (number | null)[] = Array.from({ length: n }, (_, i) => (ok[i] ? sum[i] / ok[i] : null))

    // bridge gaps with no records at all, up to two probe intervals wide
    const maxGap = Math.max(1, Math.round((2 * (task.interval || 60) * 1000) / bucket))
    let prev = -1
    for (let i = 0; i < n; i++) {
      if (values[i] === null) {
        if (lost[i]) prev = -1
        continue
      }
      const gap = i - prev - 1
      if (prev >= 0 && gap > 0 && gap <= maxGap) {
        let clean = true
        for (let j = prev + 1; j < i; j++) if (lost[j]) clean = false
        if (clean) {
          const a = values[prev] as number
          const b = values[i] as number
          for (let j = prev + 1; j < i; j++) values[j] = a + ((b - a) * (j - prev)) / (i - prev)
        }
      }
      prev = i
    }

    const cells = Math.min(n, MAX_BEATS)
    const beats: Beat[] = Array.from({ length: cells }, (_, c) => {
      const a = Math.floor((c * n) / cells)
      const b = Math.max(a + 1, Math.floor(((c + 1) * n) / cells))
      let total = 0
      let miss = 0
      let s = 0
      let cnt = 0
      for (let i = a; i < b; i++) {
        total += ok[i] + lost[i]
        miss += lost[i]
        s += sum[i]
        cnt += ok[i]
      }
      const avg = cnt ? s / cnt : null
      const pct = total ? (miss / total) * 100 : 0
      const level: Beat['level'] = !total ? 'none' : miss ? (pct >= 50 ? 'bad' : 'warn') : 'ok'
      return { from: (k0 + a) * bucket, to: (k0 + b) * bucket, total, lost: miss, avg, level }
    })

    const st = stats(samples)
    return {
      id: task.id,
      name: task.name,
      type: task.type,
      color: PING_COLORS[ti % PING_COLORS.length],
      values,
      beats,
      latest: st.latest,
      // prefer the server summary over the full window when it is present
      avg: task.total ? (task.avg ?? st.avg) : st.avg,
      min: task.total ? (task.min ?? st.min) : st.min,
      max: task.total ? (task.max ?? st.max) : st.max,
      loss: task.total ? (task.loss ?? st.loss) : st.loss,
      total: task.total || st.total,
    }
  })

  return { times, lines }
}

export interface NodePing {
  name: string
  latest: number | null
  avg: number | null
  loss: number
}

/** Per-node, per-task last-hour summary for the node cards, from the server aggregate. */
export function summarizeByNode(stats: PingStat[], tasks: PingTask[]) {
  const order = [...tasks].sort(byWeight)
  const rank = new Map(order.map((t, i) => [String(t.id), i]))
  const out: Record<string, NodePing[]> = {}
  for (const st of [...stats].sort((a, b) => (rank.get(String(a.task_id)) ?? 0) - (rank.get(String(b.task_id)) ?? 0))) {
    const task = order[rank.get(String(st.task_id)) ?? -1]
    if (!task || !st.total) continue
    const num = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null)
    ;(out[st.entity_id] ??= []).push({ name: task.name, latest: num(st.latest), avg: num(st.avg), loss: st.loss || 0 })
  }
  return out
}
