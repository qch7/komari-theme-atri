import type { NodeInfo } from './api'
import { countryName, flagToCode } from './format'

export interface GeoLoc {
  lat: number
  lon: number
  label: string
  precise: boolean
}

// [keywords, lat, lon, label]; ASCII keywords match on word boundaries, CJK by substring
const CITIES: [string[], number, number, string][] = [
  [['大阪', 'osaka', 'kix'], 34.69, 135.5, '大阪'],
  [['东京', '東京', 'tokyo', 'nrt', 'hnd'], 35.68, 139.69, '东京'],
  [['名古屋', 'nagoya'], 35.18, 136.91, '名古屋'],
  [['福冈', 'fukuoka'], 33.59, 130.4, '福冈'],
  [['札幌', 'sapporo'], 43.06, 141.35, '札幌'],
  [['上海', 'shanghai'], 31.23, 121.47, '上海'],
  [['北京', 'beijing', 'pek'], 39.9, 116.4, '北京'],
  [['广州', 'guangzhou'], 23.13, 113.26, '广州'],
  [['深圳', 'shenzhen'], 22.54, 114.06, '深圳'],
  [['杭州', 'hangzhou'], 30.27, 120.15, '杭州'],
  [['南京', 'nanjing'], 32.06, 118.8, '南京'],
  [['成都', 'chengdu'], 30.57, 104.07, '成都'],
  [['重庆', 'chongqing'], 29.56, 106.55, '重庆'],
  [['武汉', 'wuhan'], 30.59, 114.31, '武汉'],
  [['青岛', 'qingdao'], 36.07, 120.38, '青岛'],
  [['西安', "xi'an", 'xian'], 34.34, 108.94, '西安'],
  [['宁波', 'ningbo'], 29.87, 121.54, '宁波'],
  [['厦门', 'xiamen'], 24.48, 118.09, '厦门'],
  [['福州', 'fuzhou'], 26.07, 119.3, '福州'],
  [['天津', 'tianjin'], 39.34, 117.36, '天津'],
  [['沈阳', 'shenyang'], 41.8, 123.43, '沈阳'],
  [['乌兰察布', 'ulanqab'], 41.0, 113.13, '乌兰察布'],
  [['张家口', 'zhangjiakou'], 40.77, 114.88, '张家口'],
  [['呼和浩特', 'hohhot'], 40.84, 111.75, '呼和浩特'],
  [['香港', 'hong kong', 'hongkong', 'hkg'], 22.32, 114.17, '香港'],
  [['澳门', 'macau', 'macao'], 22.2, 113.54, '澳门'],
  [['台北', 'taipei'], 25.03, 121.57, '台北'],
  [['彰化', 'changhua'], 24.08, 120.54, '彰化'],
  [['新加坡', 'singapore'], 1.35, 103.82, '新加坡'],
  [['首尔', 'seoul', 'icn'], 37.57, 126.98, '首尔'],
  [['春川', 'chuncheon'], 37.88, 127.73, '春川'],
  [['釜山', 'busan'], 35.18, 129.08, '釜山'],
  [['曼谷', 'bangkok'], 13.76, 100.5, '曼谷'],
  [['吉隆坡', 'kuala lumpur'], 3.14, 101.69, '吉隆坡'],
  [['雅加达', 'jakarta'], -6.2, 106.85, '雅加达'],
  [['马尼拉', 'manila'], 14.6, 120.98, '马尼拉'],
  [['胡志明', 'ho chi minh', 'saigon'], 10.82, 106.63, '胡志明市'],
  [['河内', 'hanoi'], 21.03, 105.85, '河内'],
  [['孟买', 'mumbai', 'bom'], 19.08, 72.88, '孟买'],
  [['海得拉巴', 'hyderabad'], 17.39, 78.49, '海得拉巴'],
  [['班加罗尔', 'bangalore', 'bengaluru'], 12.97, 77.59, '班加罗尔'],
  [['迪拜', 'dubai', 'dxb'], 25.2, 55.27, '迪拜'],
  [['阿布扎比', 'abu dhabi'], 24.45, 54.38, '阿布扎比'],
  [['特拉维夫', 'tel aviv'], 32.09, 34.78, '特拉维夫'],
  [['耶路撒冷', 'jerusalem'], 31.77, 35.21, '耶路撒冷'],
  [['伊斯坦布尔', 'istanbul'], 41.01, 28.98, '伊斯坦布尔'],
  [['悉尼', 'sydney', 'syd'], -33.87, 151.21, '悉尼'],
  [['墨尔本', 'melbourne'], -37.81, 144.96, '墨尔本'],
  [['奥克兰', 'auckland'], -36.85, 174.76, '奥克兰'],
  [['洛杉矶', 'los angeles', 'lax'], 34.05, -118.24, '洛杉矶'],
  [['圣何塞', 'san jose', 'sjc'], 37.34, -121.89, '圣何塞'],
  [['硅谷', 'silicon valley'], 37.39, -122.08, '硅谷'],
  [['旧金山', 'san francisco', 'sfo'], 37.77, -122.42, '旧金山'],
  [['西雅图', 'seattle'], 47.61, -122.33, '西雅图'],
  [['凤凰城', 'phoenix'], 33.45, -112.07, '凤凰城'],
  [['盐湖城', 'salt lake'], 40.76, -111.89, '盐湖城'],
  [['达拉斯', 'dallas'], 32.78, -96.8, '达拉斯'],
  [['芝加哥', 'chicago'], 41.88, -87.63, '芝加哥'],
  [['纽约', 'new york', 'nyc'], 40.71, -74.01, '纽约'],
  [['阿什本', 'ashburn'], 39.04, -77.49, '阿什本'],
  [['弗吉尼亚', 'virginia'], 38.9, -77.4, '弗吉尼亚'],
  [['亚特兰大', 'atlanta'], 33.75, -84.39, '亚特兰大'],
  [['迈阿密', 'miami'], 25.76, -80.19, '迈阿密'],
  [['多伦多', 'toronto'], 43.65, -79.38, '多伦多'],
  [['蒙特利尔', 'montreal'], 45.5, -73.57, '蒙特利尔'],
  [['温哥华', 'vancouver'], 49.28, -123.12, '温哥华'],
  [['圣保罗', 'sao paulo', 'são paulo'], -23.55, -46.63, '圣保罗'],
  [['圣地亚哥', 'santiago'], -33.45, -70.67, '圣地亚哥'],
  [['伦敦', 'london', 'lhr'], 51.51, -0.13, '伦敦'],
  [['法兰克福', 'frankfurt', 'fra'], 50.11, 8.68, '法兰克福'],
  [['纽伦堡', 'nuremberg', 'nürnberg'], 49.45, 11.08, '纽伦堡'],
  [['阿姆斯特丹', 'amsterdam', 'ams'], 52.37, 4.9, '阿姆斯特丹'],
  [['巴黎', 'paris', 'cdg'], 48.86, 2.35, '巴黎'],
  [['马赛', 'marseille'], 43.3, 5.37, '马赛'],
  [['马德里', 'madrid'], 40.42, -3.7, '马德里'],
  [['米兰', 'milan'], 45.46, 9.19, '米兰'],
  [['苏黎世', 'zurich', 'zürich'], 47.38, 8.54, '苏黎世'],
  [['斯德哥尔摩', 'stockholm'], 59.33, 18.07, '斯德哥尔摩'],
  [['赫尔辛基', 'helsinki'], 60.17, 24.94, '赫尔辛基'],
  [['华沙', 'warsaw'], 52.23, 21.01, '华沙'],
  [['都柏林', 'dublin'], 53.35, -6.26, '都柏林'],
  [['莫斯科', 'moscow'], 55.76, 37.62, '莫斯科'],
  [['约翰内斯堡', 'johannesburg'], -26.2, 28.05, '约翰内斯堡'],
]

// Rough "where servers usually live" points per country, [lat, lon]
const COUNTRY: Record<string, [number, number]> = {
  JP: [35.68, 139.69], CN: [31.23, 121.47], HK: [22.32, 114.17], MO: [22.2, 113.54], TW: [25.03, 121.57],
  SG: [1.35, 103.82], KR: [37.57, 126.98], US: [39.5, -98.35], CA: [45.42, -75.7], MX: [19.43, -99.13],
  BR: [-23.55, -46.63], AR: [-34.6, -58.38], CL: [-33.45, -70.67], CO: [4.71, -74.07], PE: [-12.05, -77.04],
  GB: [51.51, -0.13], DE: [50.11, 8.68], FR: [48.86, 2.35], NL: [52.37, 4.9], IE: [53.35, -6.26],
  ES: [40.42, -3.7], PT: [38.72, -9.14], IT: [45.46, 9.19], CH: [47.38, 8.54], AT: [48.21, 16.37],
  BE: [50.85, 4.35], LU: [49.61, 6.13], SE: [59.33, 18.07], NO: [59.91, 10.75], FI: [60.17, 24.94],
  DK: [55.68, 12.57], PL: [52.23, 21.01], CZ: [50.08, 14.44], HU: [47.5, 19.04], RO: [44.43, 26.1],
  BG: [42.7, 23.32], GR: [37.98, 23.73], UA: [50.45, 30.52], RU: [55.76, 37.62], TR: [41.01, 28.98],
  IL: [32.09, 34.78], AE: [25.2, 55.27], SA: [24.71, 46.68], QA: [25.29, 51.53], IN: [19.08, 72.88],
  PK: [24.86, 67.0], BD: [23.81, 90.41], TH: [13.76, 100.5], MY: [3.14, 101.69], ID: [-6.2, 106.85],
  PH: [14.6, 120.98], VN: [10.82, 106.63], KH: [11.56, 104.92], MN: [47.89, 106.91], KZ: [43.24, 76.89],
  AU: [-33.87, 151.21], NZ: [-36.85, 174.76], ZA: [-26.2, 28.05], EG: [30.04, 31.24], NG: [6.52, 3.38],
  KE: [-1.29, 36.82], IS: [64.15, -21.94], EE: [59.44, 24.75], LV: [56.95, 24.11], LT: [54.69, 25.28],
  RS: [44.79, 20.45], HR: [45.81, 15.98], SI: [46.06, 14.51], SK: [48.15, 17.11], MD: [47.01, 28.86],
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchCity(name: string): GeoLoc | null {
  const lower = name.toLowerCase()
  for (const [kws, lat, lon, label] of CITIES) {
    for (const kw of kws) {
      if (/^[\x00-\x7f]+$/.test(kw)) {
        if (new RegExp(`(^|[^a-z])${escapeRe(kw)}([^a-z]|$)`).test(lower)) return { lat, lon, label, precise: true }
      } else if (name.includes(kw)) {
        return { lat, lon, label, precise: true }
      }
    }
  }
  return null
}

export function parseOverrides(raw: unknown): Record<string, GeoLoc> {
  const out: Record<string, GeoLoc> = {}
  if (!raw) return out
  let obj: any = raw
  if (typeof raw === 'string') {
    const txt = raw.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').trim()
    if (!txt) return out
    try {
      obj = JSON.parse(txt)
    } catch {
      return out
    }
  }
  if (!obj || typeof obj !== 'object') return out
  for (const [k, v] of Object.entries(obj)) {
    let lat: number | undefined, lon: number | undefined, label = ''
    if (Array.isArray(v)) {
      ;[lat, lon] = v.map(Number)
      if (typeof v[2] === 'string') label = v[2]
    } else if (v && typeof v === 'object') {
      const o = v as any
      lat = Number(o.lat ?? o.latitude)
      lon = Number(o.lon ?? o.lng ?? o.longitude)
      label = typeof o.label === 'string' ? o.label : ''
    }
    if (Number.isFinite(lat) && Number.isFinite(lon)) out[k] = { lat: lat!, lon: lon!, label, precise: true }
  }
  return out
}

export function locate(node: NodeInfo, overrides: Record<string, GeoLoc>): GeoLoc | null {
  const code = flagToCode(node.region)
  const ov = overrides[node.uuid] || overrides[node.name]
  if (ov) return { ...ov, label: ov.label || matchCity(node.name)?.label || countryName(code) }
  const city = matchCity(node.name)
  if (city) return city
  if (code && COUNTRY[code]) {
    const [lat, lon] = COUNTRY[code]
    return { lat, lon, label: countryName(code), precise: false }
  }
  return null
}
