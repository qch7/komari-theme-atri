const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

export function bytes(n: number | undefined | null, digits = 1): string {
  if (!n || n < 0 || !isFinite(n)) return '0 B'
  let i = 0
  while (n >= 1024 && i < UNITS.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : digits)} ${UNITS[i]}`
}

export const speed = (n: number | undefined | null) => `${bytes(n)}/s`

export function pct(used: number | undefined, total: number | undefined): number {
  if (!total || !used) return 0
  return Math.max(0, Math.min(100, (used / total) * 100))
}

export function uptime(sec: number | undefined): string {
  if (!sec || sec < 0) return '—'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d} 天 ${h} 时`
  if (h > 0) return `${h} 时 ${m} 分`
  return `${m} 分`
}

export function ago(iso: string | undefined | null): string {
  if (!iso) return '很久以前'
  const t = Date.parse(iso)
  if (!t || t < 946684800000) return '很久以前'
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return '刚刚'
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`
  return `${Math.floor(s / 86400)} 天前`
}

export function osShort(os: string): string {
  if (!os) return '未知系统'
  return os.replace(/\s*LTS\s*/i, ' ').replace(/GNU\/Linux/i, '').trim()
}

export function flagToCode(region: string): string | null {
  if (!region) return null
  const cps = Array.from(region).map((c) => c.codePointAt(0) || 0)
  const ri = cps.filter((c) => c >= 0x1f1e6 && c <= 0x1f1ff)
  if (ri.length >= 2) return String.fromCharCode(ri[0] - 0x1f1e6 + 65, ri[1] - 0x1f1e6 + 65)
  const m = region.trim().match(/^[A-Za-z]{2}$/)
  return m ? m[0].toUpperCase() : null
}

let regionNames: Intl.DisplayNames | null = null
export function countryName(code: string | null): string {
  if (!code) return '未知海域'
  try {
    regionNames ??= new Intl.DisplayNames(['zh-CN'], { type: 'region' })
    return regionNames.of(code) || code
  } catch {
    return code
  }
}
