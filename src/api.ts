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

export const getPublic = () => getJSON<PublicInfo>('/api/public')
export const getNodes = async () => (await getJSON<NodeInfo[]>('/api/nodes')) || []
export const getLatest = async () => (await rpc<Record<string, NodeStatus>>('common:getNodesLatestStatus')) || {}
export const getRecords = async (uuid: string, hours: number) => {
  const d = await getJSON<{ records: LoadRecord[] | null }>(
    `/api/records/load?uuid=${encodeURIComponent(uuid)}&hours=${hours}`,
  )
  return d?.records || []
}
