// Dev-only synthetic latency data for previewing the ping UI (`?ping-demo`). Never shipped in builds.
import type { PingOverview, PingRecord, PingResult, PingStat, PingTask } from './api'

const TASKS: PingTask[] = [
  { id: 101, name: '上海电信', type: 'icmp', interval: 30, weight: 1, default_on: true },
  { id: 102, name: '广州移动', type: 'tcp', interval: 60, weight: 2, default_on: true },
  { id: 103, name: '北京联通', type: 'icmp', interval: 60, weight: 3, default_on: true },
]

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function series(uuid: string, task: PingTask, hours: number): PingRecord[] {
  const h = hash(uuid + task.id)
  const base = 28 + (h % 140)
  const step = task.interval * 1000
  const end = Math.floor(Date.now() / step) * step
  const start = end - hours * 3600000
  const out: PingRecord[] = []
  for (let t = start; t <= end; t += step) {
    // deterministic per slot so refreshes look continuous
    const r = rng(h ^ Math.floor(t / step))
    const hour = new Date(t).getHours() + new Date(t).getMinutes() / 60
    const peak = Math.max(0, Math.sin(((hour - 15) / 9) * Math.PI)) * base * 0.6 // evening rush
    const wobble = Math.sin(t / 700000 + (h % 7)) * base * 0.08
    const roll = r()
    const lossRate = (h % 5 === 0 ? 0.05 : 0.008) + (peak > base * 0.4 ? 0.03 : 0)
    const value = roll < lossRate ? -1 : Math.round(base + peak + wobble + r() * base * 0.18 + (roll > 0.985 ? base * 1.5 : 0))
    out.push({ task_id: task.id, time: new Date(t).toISOString(), value, client: uuid })
  }
  return out
}

export function demoNodePing(uuid: string, hours: number): PingResult {
  const tasks = TASKS.filter((t) => hash(uuid + t.id) % 4 !== 0 || t.id === 101)
  return { tasks, records: tasks.flatMap((t) => series(uuid, t, hours)) }
}

export function demoOverview(uuids: string[]): PingOverview {
  const tasks = TASKS.map((t) => ({ ...t, clients: uuids }))
  const stats: PingStat[] = []
  for (const uuid of uuids) {
    for (const t of demoNodePing(uuid, 1).tasks) {
      const rs = series(uuid, t, 1)
      const ok = rs.filter((r) => r.value >= 0)
      stats.push({
        entity_id: uuid,
        task_id: String(t.id),
        total: rs.length,
        valid: ok.length,
        loss: rs.length ? ((rs.length - ok.length) / rs.length) * 100 : 0,
        latest: ok.length ? ok[ok.length - 1].value : null,
        avg: ok.length ? ok.reduce((a, r) => a + r.value, 0) / ok.length : null,
      })
    }
  }
  return { tasks, stats }
}
