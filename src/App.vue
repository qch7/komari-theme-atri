<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getLatest, getNodes, getPingOverview, getPublic, type NodeInfo, type NodeStatus, type PublicInfo } from './api'
import { bytes, flagToCode, pct, speed } from './format'
import { summarizeByNode, type NodePing } from './ping'
import { locate, parseOverrides, type GeoLoc } from './geo'
import { LINES, fill, pick } from './lines'
import { playVoice, VOICES } from './sound'
import type { GlobePoint, Mood } from './types'
import Globe from './components/Globe.vue'
import AtriDialog from './components/AtriDialog.vue'
import NodeCard from './components/NodeCard.vue'
import NodeDetail from './components/NodeDetail.vue'
import Shore from './components/Shore.vue'
import Icon from './components/Icon.vue'
import Sprite from './components/Sprite.vue'
import head from './assets/atri/atri_head.webp'
import happy from './assets/atri/atri_happy.webp'

const DEFAULTS = {
  greeting: '',
  master_name: '夏生先生',
  voice_enabled: true,
  show_swimmer: true,
  globe_speed: 6,
  show_routes: true,
  node_locations: '',
  refresh_interval: 3,
  offline_last: true,
}

const pub = ref<PublicInfo | null>(null)
const nodes = ref<NodeInfo[]>([])
const status = ref<Record<string, NodeStatus>>({})
const loaded = ref(false)
const error = ref('')
const group = ref('全部')
const selected = ref<string | null>(null)
const flash = ref<Set<string>>(new Set())
const focus = ref<{ lat: number; lon: number; seq: number } | null>(null)
const dialog = ref<InstanceType<typeof AtriDialog>>()

const settings = computed(() => {
  const raw = (pub.value?.theme_settings || {}) as Record<string, unknown>
  const out: Record<string, any> = { ...DEFAULTS }
  for (const k of Object.keys(DEFAULTS)) if (raw[k] !== undefined && raw[k] !== null) out[k] = raw[k]
  out.globe_speed = Number(out.globe_speed)
  if (!Number.isFinite(out.globe_speed)) out.globe_speed = DEFAULTS.globe_speed
  out.refresh_interval = Math.max(2, Number(out.refresh_interval) || DEFAULTS.refresh_interval)
  return out as typeof DEFAULTS
})

// ---------- appearance ----------
const appearance = ref(localStorage.getItem('appearance') || 'system')
const mq = matchMedia('(prefers-color-scheme: dark)')
const sysDark = ref(mq.matches)
const onMq = (e: MediaQueryListEvent) => (sysDark.value = e.matches)
const dark = computed(() => appearance.value === 'dark' || (appearance.value === 'system' && sysDark.value))
watch(
  dark,
  (v) => {
    document.documentElement.classList.toggle('dark', v)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', v ? '#0b1631' : '#7fd0ff')
  },
  { immediate: true },
)
function toggleTheme() {
  appearance.value = dark.value ? 'light' : 'dark'
  localStorage.setItem('appearance', appearance.value)
}

const soundOn = ref(localStorage.getItem('atri_sound') !== 'off')
function toggleSound() {
  soundOn.value = !soundOn.value
  localStorage.setItem('atri_sound', soundOn.value ? 'on' : 'off')
  if (soundOn.value) playVoice(VOICES.ui, 0.5)
}
const voiceOk = computed(() => settings.value.voice_enabled && soundOn.value)

// ---------- data ----------
let statusTimer = 0
let nodesTimer = 0

let fails = 0
async function refreshStatus() {
  try {
    status.value = await getLatest()
    fails = 0
    error.value = ''
  } catch (e) {
    // one dropped poll is normal; only complain after a few in a row
    if (++fails >= 3 || !Object.keys(status.value).length) error.value = (e as Error).message || '网络错误'
  }
}

function scheduleStatus() {
  clearTimeout(statusTimer)
  const ms = document.hidden ? 15000 : settings.value.refresh_interval * 1000
  statusTimer = window.setTimeout(async () => {
    await refreshStatus()
    scheduleStatus()
  }, ms)
}

async function refreshNodes() {
  try {
    nodes.value = await getNodes()
  } catch {
    /* keep the old list */
  }
}

// latency for the node cards; probes run every 30–60 s, so a slow poll is plenty
const pings = ref<Record<string, NodePing[]>>({})
let pingTimer = 0
async function refreshPing() {
  if (document.hidden && Object.keys(pings.value).length) return
  try {
    const r = await getPingOverview(nodes.value.map((n) => n.uuid))
    pings.value = summarizeByNode(r.stats, r.tasks)
  } catch {
    /* latency is optional; keep what we had */
  }
}

let bootTimer = 0
async function boot() {
  try {
    const [p, n] = await Promise.all([getPublic(), getNodes()])
    pub.value = p
    nodes.value = n
    await refreshStatus()
  } catch (e) {
    error.value = (e as Error).message || '网络错误'
    loaded.value = true
    bootTimer = window.setTimeout(boot, 6000)
    return
  }
  loaded.value = true
  scheduleStatus()
  nodesTimer = window.setInterval(refreshNodes, 60000)
  refreshPing()
  pingTimer = window.setInterval(refreshPing, 60000)
}

const onVis = () => {
  if (!document.hidden) {
    refreshStatus()
    scheduleStatus()
  }
}

onMounted(() => {
  mq.addEventListener('change', onMq)
  document.addEventListener('visibilitychange', onVis)
  boot()
})
onBeforeUnmount(() => {
  mq.removeEventListener('change', onMq)
  document.removeEventListener('visibilitychange', onVis)
  clearTimeout(statusTimer)
  clearTimeout(bootTimer)
  clearInterval(nodesTimer)
  clearInterval(pingTimer)
})

// ---------- derived ----------
const isOnline = (uuid: string) => !!status.value[uuid]?.online

const groups = computed(() => {
  const set = new Set(nodes.value.map((n) => n.group).filter(Boolean))
  return set.size ? ['全部', ...set] : []
})

const sorted = computed(() => {
  const list = nodes.value.filter((n) => group.value === '全部' || n.group === group.value)
  return [...list].sort((a, b) => {
    if (settings.value.offline_last) {
      const d = Number(isOnline(b.uuid)) - Number(isOnline(a.uuid))
      if (d) return d
    }
    return (a.weight || 0) - (b.weight || 0) || a.name.localeCompare(b.name, 'zh-CN')
  })
})

const overrides = computed(() => parseOverrides(settings.value.node_locations))
const locs = computed(() => {
  const out: Record<string, GeoLoc | null> = {}
  for (const n of nodes.value) out[n.uuid] = locate(n, overrides.value)
  return out
})

const points = computed<GlobePoint[]>(() => {
  const map = new Map<string, GlobePoint>()
  for (const n of nodes.value) {
    const l = locs.value[n.uuid]
    if (!l) continue
    const key = `${l.lat.toFixed(1)},${l.lon.toFixed(1)}`
    let p = map.get(key)
    if (!p) {
      p = { key, lat: l.lat, lon: l.lon, label: l.label, nodes: [] }
      map.set(key, p)
    }
    p.nodes.push({ uuid: n.uuid, name: n.name, online: isOnline(n.uuid) })
  }
  return [...map.values()]
})

const online = computed(() => nodes.value.filter((n) => isOnline(n.uuid)))
const offline = computed(() => (loaded.value && !error.value ? nodes.value.filter((n) => !isOnline(n.uuid)) : []))
const sum = (f: (s: NodeStatus) => number) => online.value.reduce((a, n) => a + (f(status.value[n.uuid]) || 0), 0)
const totals = computed(() => ({
  up: sum((s) => s.net_out),
  down: sum((s) => s.net_in),
  tUp: nodes.value.reduce((a, n) => a + (status.value[n.uuid]?.net_total_up || 0), 0),
  tDown: nodes.value.reduce((a, n) => a + (status.value[n.uuid]?.net_total_down || 0), 0),
  regions: new Set(nodes.value.map((n) => flagToCode(n.region) || n.region).filter(Boolean)).size,
  cities: points.value.length,
}))

const master = computed(() => String(settings.value.master_name || '夏生先生'))
const busy = computed(() => online.value.filter((n) => (status.value[n.uuid]?.cpu ?? 0) >= 85))
const memHigh = computed(() =>
  online.value.filter((n) => pct(status.value[n.uuid]?.ram, status.value[n.uuid]?.ram_total || n.mem_total) >= 90),
)
const diskHigh = computed(() =>
  online.value.filter((n) => pct(status.value[n.uuid]?.disk, status.value[n.uuid]?.disk_total || n.disk_total) >= 90),
)

const mood = computed<Mood>(() => (error.value || offline.value.length ? 'cry' : 'normal'))
const poolKey = computed(
  () =>
    `${loaded.value}|${error.value ? 1 : 0}|${offline.value.map((n) => n.uuid).join()}|${busy.value.length}|${memHigh.value.length}`,
)

function vars(extra: Record<string, string | number> = {}) {
  return { m: master.value, n: nodes.value.length, ...extra }
}

const pool = computed(() => {
  if (!loaded.value) return LINES.loading
  if (error.value) return LINES.error.map((l) => fill(l, vars()))
  const out: string[] = []
  const g = String(settings.value.greeting || '').trim()
  offline.value.forEach((n, i) => out.push(fill(LINES.offline[i % LINES.offline.length], vars({ name: n.name }))))
  busy.value.forEach((n) =>
    out.push(fill(pick(LINES.busy), vars({ name: n.name, cpu: Math.round(status.value[n.uuid].cpu) }))),
  )
  memHigh.value.forEach((n) => {
    const s = status.value[n.uuid]
    out.push(fill(LINES.memory[0], vars({ name: n.name, mem: Math.round(pct(s.ram, s.ram_total || n.mem_total)) })))
  })
  diskHigh.value.forEach((n) => {
    const s = status.value[n.uuid]
    out.push(fill(LINES.disk[0], vars({ name: n.name, disk: Math.round(pct(s.disk, s.disk_total || n.disk_total)) })))
  })
  if (g) out.push(fill(g, vars()))
  const h = new Date().getHours()
  if (h < 6) out.push(...LINES.night.map((l) => fill(l, vars())))
  else if (h < 10) out.push(...LINES.morning.map((l) => fill(l, vars())))
  if (offline.value.length) {
    if (online.value.length) out.push(`剩下的 ${online.value.length} 台还在努力运转。交给我吧，有高性能的我陪着呢！`)
  } else {
    out.push(...LINES.online.map((l) => fill(l, vars())))
  }
  return out
})

const selectedNode = computed(() => nodes.value.find((n) => n.uuid === selected.value) || null)
const detailLine = computed(() =>
  selectedNode.value
    ? isOnline(selectedNode.value.uuid)
      ? fill(pick(LINES.detail), vars({ name: selectedNode.value.name }))
      : fill(LINES.offline[0], vars({ name: selectedNode.value.name }))
    : '',
)

// ---------- interactions ----------
function open(uuid: string) {
  selected.value = uuid
  const l = locs.value[uuid]
  if (l) focus.value = { lat: l.lat, lon: l.lon, seq: Date.now() }
  if (voiceOk.value) playVoice(VOICES.ui, 0.45)
}

async function onGlobeSelect(p: GlobePoint) {
  if (p.nodes.length === 1) return open(p.nodes[0].uuid)
  focus.value = { lat: p.lat, lon: p.lon, seq: Date.now() }
  group.value = '全部'
  flash.value = new Set(p.nodes.map((n) => n.uuid))
  dialog.value?.say(`${p.label}有 ${p.nodes.length} 台服务器哦：${p.nodes.map((n) => n.name).join('、')}。`, 'happy', 3000)
  await nextTick()
  document.getElementById(`node-${p.nodes[0].uuid}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  setTimeout(() => (flash.value = new Set()), 2600)
}

function poke() {
  if (offline.value.length) {
    const n = pick(offline.value)
    dialog.value?.say(fill(pick(LINES.offline), vars({ name: n.name })), 'cry', 3000)
    if (voiceOk.value) playVoice(VOICES.sad)
    return
  }
  const line = fill(pick(LINES.poke), vars())
  const isPunch = line.includes('火箭飞拳')
  dialog.value?.say(line, isPunch ? 'punch' : 'happy', 3200)
  if (voiceOk.value) playVoice(isPunch ? VOICES.punch : VOICES.poke)
}

function onCrab() {
  dialog.value?.say(fill(pick(LINES.crab), vars()), 'happy', 3000)
  if (voiceOk.value) playVoice(VOICES.crab)
}

const siteName = computed(() => pub.value?.sitename || 'Komari Monitor')
const isPrivate = computed(() => /private/i.test(error.value))
</script>

<template>
  <div class="app">
    <div class="sky" aria-hidden="true">
      <template v-if="!dark">
        <svg v-for="i in 5" :key="i" class="cloud" :class="`c${i}`" viewBox="0 0 120 64">
          <path
            d="M22 56 C6 56 4 36 18 33 C16 18 34 10 44 20 C50 4 78 4 82 22 C96 14 112 26 104 40 C116 44 112 58 98 56 Z"
          />
        </svg>
      </template>
      <template v-else>
        <span class="moon" />
        <span v-for="i in 28" :key="i" class="star" :style="{ '--i': i }" />
      </template>
    </div>

    <header class="topbar">
      <a class="brand" href="/">
        <img :src="head" alt="" class="brand-head" />
        <span class="brand-text">
          <b class="outlined">{{ siteName }}</b>
          <small>ATRI -My Dear Servers-</small>
        </span>
      </a>
      <nav class="actions">
        <button
          v-if="settings.voice_enabled"
          class="icon-btn"
          type="button"
          :title="soundOn ? '静音' : '开启语音'"
          @click="toggleSound"
        >
          <Icon :name="soundOn ? 'sound' : 'mute'" size="26px" />
        </button>
        <button class="icon-btn" type="button" :title="dark ? '白昼之海' : '沉没的星星'" @click="toggleTheme">
          <Icon :name="dark ? 'sun' : 'moon'" size="28px" />
        </button>
        <a class="icon-btn admin" href="/admin" title="管理后台"><Icon name="gear" size="26px" /></a>
      </nav>
    </header>

    <section class="hero">
      <div class="hero-globe">
        <div class="tag"><Icon name="globe" size="20px" />Log.01 · 地球观测</div>
        <Globe
          :points="points"
          :dark="dark"
          :speed="settings.globe_speed"
          :routes="settings.show_routes"
          :focus="focus"
          @select="onGlobeSelect"
          @crab="onCrab"
        />
        <div class="legend">
          <span><i class="dot ok" />全部在线</span>
          <span><i class="dot warn" />部分离线</span>
          <span><i class="dot off" />离线</span>
          <span class="tip">拖动地球 · 点击图钉</span>
        </div>
      </div>
      <div class="hero-side">
        <AtriDialog ref="dialog" :mood="mood" :pool="pool" :pool-key="poolKey" @poke="poke" />
        <div class="boards">
          <div class="board">
            <span class="board-k"><Icon name="heart" size="16px" />在线节点</span>
            <b class="board-v outlined">{{ online.length }}<small> / {{ nodes.length }}</small></b>
          </div>
          <div class="board">
            <span class="board-k"><Icon name="wave" size="16px" />实时速率</span>
            <b class="board-v sm outlined"><Icon name="up" size="20px" />{{ speed(totals.up) }}</b>
            <b class="board-v sm outlined"><Icon name="down" size="20px" />{{ speed(totals.down) }}</b>
          </div>
          <div class="board">
            <span class="board-k"><Icon name="anchor" size="16px" />累计流量</span>
            <b class="board-v sm outlined"><Icon name="up" size="20px" />{{ bytes(totals.tUp) }}</b>
            <b class="board-v sm outlined"><Icon name="down" size="20px" />{{ bytes(totals.tDown) }}</b>
          </div>
          <div class="board">
            <span class="board-k"><Icon name="pin" size="16px" />分布海域</span>
            <b class="board-v outlined">{{ totals.cities }}<small> 处 · {{ totals.regions }} 地区</small></b>
          </div>
        </div>
      </div>
    </section>

    <Shore :swimmer="settings.show_swimmer" @crab="onCrab" @poke="poke" />

    <main class="sea">
      <div class="rays" aria-hidden="true" />
      <div class="bubbles" aria-hidden="true">
        <span v-for="i in 16" :key="i" :style="{ '--i': i }" />
      </div>

      <div class="list-head">
        <h2 class="ribbon"><span><Icon name="anchor" size="22px" />Log.02 · 打捞作业</span></h2>
        <div v-if="groups.length" class="groups">
          <button
            v-for="g in groups"
            :key="g"
            type="button"
            :class="{ active: group === g }"
            @click="group = g"
          >
            {{ g }}
          </button>
        </div>
      </div>

      <div v-if="error && loaded" class="alert">
        <Sprite name="sink" :height="90" :speed="0.9" />
        <div>
          <b>{{ isPrivate ? '这是私有站点，需要先登录哦。' : '数据打捞失败了……' }}</b>
          <small>{{ error }}</small>
          <a v-if="isPrivate" href="/admin" class="go">前往登录 <Icon name="right" size="18px" /></a>
        </div>
      </div>

      <div class="grid">
        <NodeCard
          v-for="n in sorted"
          :id="`node-${n.uuid}`"
          :key="n.uuid"
          :class="{ flash: flash.has(n.uuid) }"
          :node="n"
          :status="status[n.uuid]"
          :place="locs[n.uuid]?.label || ''"
          :ping="pings[n.uuid]"
          @open="open(n.uuid)"
        />
      </div>
      <div v-if="loaded && !error && !nodes.length" class="empty">
        <Sprite name="sink" :height="90" :speed="0.9" />
        <p>海里还什么都没有……去管理后台添加服务器吧！</p>
      </div>

      <footer class="footer">
        <button class="footer-atri" type="button" aria-label="亚托莉" @click="poke">
          <img :src="happy" alt="" />
          <span class="footer-say">今天也辛苦了，{{ master }}！</span>
        </button>
        <p>Powered by Komari Monitor.</p>
        <p class="credit">
          Theme「亚托莉 · 我挚爱的服务器」· 角色素材 ©ATRI -My Dear Moments- / ANIPLEX.EXE · 仅供个人展示
        </p>
      </footer>
    </main>

    <NodeDetail
      v-if="selectedNode"
      :node="selectedNode"
      :status="status[selectedNode.uuid]"
      :place="locs[selectedNode.uuid]?.label || ''"
      :line="detailLine"
      @close="selected = null"
    />

    <Transition name="fade">
      <div v-if="!loaded" class="loading">
        <span class="loading-swim"><Sprite name="swim" :height="170" /></span>
        <p>正在进行打捞作业……</p>
      </div>
    </Transition>
  </div>
</template>
