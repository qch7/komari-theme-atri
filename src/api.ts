export interface NodeInfo {
  uuid: string
  name: string
  cpu_name: string
  virtualization: string
  arch: string
  cpu_cores: number
  os: string
  kernel_version: string
  gpu_name: string
  region: string
  public_remark?: string
  mem_total: number
  swap_total: number
  disk_total: number
  weight: number
  price: number
  billing_cycle: number
  currency: string
  expired_at: string | null
  group: string
  tags: string
  hidden: boolean
  traffic_limit: number
  traffic_limit_type: string
}

export interface NodeStatus {
  client: string
  time: string
  cpu: number
  ram: number
  ram_total: number
  swap: number
  swap_total: number
  load: number
  load5: number
  load15: number
  disk: number
  disk_total: number
  net_in: number
  net_out: number
  net_total_up: number
  net_total_down: number
  process: number
  connections: number
  connections_udp: number
  online: boolean
  uptime: number
}

export interface LoadRecord {
  time: string
  cpu: number
  ram: number
  swap?: number
  disk: number
  load: number
  net_in: number
  net_out: number
  connections: number
  connections_udp: number
  process: number
}

export interface PublicInfo {
  sitename: string
  description: string
  private_site: boolean
  theme_settings?: Record<string, unknown>
  [k: string]: unknown
}

const TIMEOUT = 12000
const signal = () => (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(TIMEOUT) : undefined)

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: 'same-origin', signal: signal() })
  const text = await r.text()
  let j: any
  try {
    j = JSON.parse(text)
  } catch {
    throw new Error(`HTTP ${r.status}`)
  }
  if (j && typeof j === 'object' && 'status' in j && j.status !== 'success') {
    throw new Error(j.message || `HTTP ${r.status}`)
  }
  return (j?.data ?? j) as T
}

let rpcId = 1
async function rpc<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch('/api/rpc2', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    signal: signal(),
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: rpcId++ }),
  })
  const j = await r.json()
  if (j.error) throw new Error(j.error.message || 'RPC error')
  return j.result as T
}

export interface PingRecord {
  task_id: number
  time: string
  /** Round-trip time in ms; negative means the probe was lost. */
  value: number
  client?: string
}

export interface PingTask {
  id: number
  name: string
  type: string
  interval: number
  weight?: number
  default_on?: boolean
  clients?: string[]
  loss?: number
  min?: number
  max?: number
  avg?: number
  total?: number
}

export interface PingResult {
  records: PingRecord[]
  tasks: PingTask[]
}

// Dev-only: `?ping-demo` swaps in synthetic latency data; the branch is dropped from production builds
const pingDemo = () => import.meta.env.DEV && new URLSearchParams(location.search).has('ping-demo')

// Tasks a GFW-detection tool creates and toggles on its own; they are tooling, not latency the visitor cares about
const isInternalTask = (t: PingTask) => /^\[Komari GFW:/i.test(t.name)

function visible(r: PingResult): PingResult {
  const hidden = new Set(r.tasks.filter(isInternalTask).map((t) => t.id))
  if (!hidden.size) return r
  return { tasks: r.tasks.filter((t) => !hidden.has(t.id)), records: r.records.filter((x) => !hidden.has(x.task_id)) }
}

export async function getNodePing(uuid: string, hours: number): Promise<PingResult> {
  if (import.meta.env.DEV && pingDemo()) return (await import('./pingDemo')).demoNodePing(uuid, hours)
  const d = await getJSON<{ records: PingRecord[] | null; tasks?: PingTask[] | null }>(
    `/api/records/ping?uuid=${encodeURIComponent(uuid)}&hours=${hours}`,
  )
  return visible({ records: d?.records || [], tasks: d?.tasks || [] })
}

/** Server-side aggregate of one node × task (`public:getPingMetricStats`, Komari ≥ 1.6.1). */
export interface PingStat {
  entity_id: string
  task_id: string | number
  total: number
  valid: number
  loss: number
  latest?: number | null
  avg?: number | null
}

export interface PingOverview {
  tasks: PingTask[]
  stats: PingStat[]
}

/**
 * Last-hour latency summary of every visible node in one aggregate query, the way the official
 * frontend does it; hidden nodes are filtered by the server.
 */
export async function getPingOverview(uuids: string[]): Promise<PingOverview> {
  if (import.meta.env.DEV && pingDemo()) return (await import('./pingDemo')).demoOverview(uuids)
  // only `clients` decides which nodes a task probes; default_on just pre-ticks newly added nodes
  const tasks = ((await getJSON<PingTask[] | null>('/api/task/ping')) || []).filter(
    (t) => (t.clients?.length ?? 0) > 0 && !isInternalTask(t),
  )
  if (!tasks.length) return { tasks, stats: [] }
  const assigned = new Map(tasks.map((t) => [String(t.id), new Set(t.clients)]))
  const r = await rpc<{ stats: PingStat[] | null }>('public:getPingMetricStats', { hours: 1 })
  // drop pairs left over from tasks since deleted or unassigned from that node
  const stats = (r?.stats || []).filter((s) => assigned.get(String(s.task_id))?.has(s.entity_id))
  return { tasks, stats }
}

export const getPublic = () => getJSON<PublicInfo>('/api/public')
export const getNodes = async () => (await getJSON<NodeInfo[]>('/api/nodes')) || []
export const getLatest = async () => (await rpc<Record<string, NodeStatus>>('common:getNodesLatestStatus')) || {}
export const getRecords = async (uuid: string, hours: number) => {
  const d = await getJSON<{ records: LoadRecord[] | null }>(
    `/api/records/load?uuid=${encodeURIComponent(uuid)}&hours=${hours}`,
  )
  return d?.records || []
}
