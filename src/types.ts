export interface GlobePoint {
  key: string
  lat: number
  lon: number
  label: string
  nodes: { uuid: string; name: string; online: boolean }[]
}

export type Mood = 'normal' | 'happy' | 'cry' | 'punch'
