<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getRecords, type LoadRecord, type NodeInfo, type NodeStatus } from '../api'
import { ago, bytes, osShort, speed, uptime } from '../format'
import Chart from './Chart.vue'
import Icon from './Icon.vue'
import PingPanel from './PingPanel.vue'
import Sprite from './Sprite.vue'
import peek from '../assets/atri/treasure_peek.webp'
import cheer from '../assets/atri/treasure_cheer.webp'

const props = defineProps<{ node: NodeInfo; status?: NodeStatus; place: string; line: string }>()
const emit = defineEmits<{ close: [] }>()

const RANGES = [
  { h: 0, label: '实时' },
  { h: 1, label: '1 小时' },
  { h: 6, label: '6 小时' },
  { h: 24, label: '24 小时' },
]
const hours = ref(0)
const records = ref<LoadRecord[]>([])
const liveRecords = ref<LoadRecord[]>([])
const LIVE_WINDOW = 10 * 60000
const MAX_LIVE_POINTS = 120
const loading = ref(false)
const opened = ref(false) // treasure chest: peek while the first load runs, then cheer
const err = ref('')
let timer = 0
let liveTimer = 0
let revealTimer = 0
let requestId = 0
let previousOverflow = ''

function appendLive(incoming: LoadRecord[]) {
  const cutoff = Date.now() - LIVE_WINDOW
  const points = new Map<number, LoadRecord>()
  for (const record of [...liveRecords.value, ...incoming]) {
    const time = Date.parse(record.time)
    if (Number.isFinite(time) && time >= cutoff) points.set(time, record)
  }
  liveRecords.value = [...points.values()]
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
    .slice(-MAX_LIVE_POINTS)
}

watch(
  [() => props.node.uuid, () => props.status],
  ([uuid, status], previous) => {
    if (uuid !== previous?.[0]) liveRecords.value = []
    if (status) appendLive([status])
  },
  { immediate: true },
)

async function load(reset = false) {
  const id = ++requestId
  if (reset) records.value = []
  loading.value = true
  err.value = ''
  try {
    const result = await getRecords(props.node.uuid, hours.value || 1)
    if (id !== requestId) return
    const sorted = result
      .filter((r) => Number.isFinite(Date.parse(r.time)))
      .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
    if (hours.value === 0) appendLive([...sorted, ...liveRecords.value])
    else records.value = sorted
  } catch (e) {
    if (id !== requestId) return
    err.value = (e as Error).message
  } finally {
    if (id === requestId) {
      loading.value = false
      if (!opened.value) {
        clearTimeout(revealTimer)
        revealTimer = window.setTimeout(() => (opened.value = true), 350)
      }
    }
  }
}

watch(
  () => [props.node.uuid, hours.value],
  () => load(true),
)
onMounted(() => {
  load()
  timer = window.setInterval(() => {
    if (hours.value > 0 && !loading.value) load()
  }, 60000)
  liveTimer = window.setInterval(() => {
    const first = liveRecords.value[0]
    if (first && Date.parse(first.time) < Date.now() - LIVE_WINDOW) appendLive([])
  }, 1000)
  document.addEventListener('keydown', onKey)
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
})
onBeforeUnmount(() => {
  requestId++
  clearInterval(timer)
  clearInterval(liveTimer)
  clearTimeout(revealTimer)
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = previousOverflow
})
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

const activeRecords = computed(() => hours.value === 0 ? liveRecords.value : records.value)
const times = computed(() => activeRecords.value.map((r) => Date.parse(r.time)))
const lastRecordTime = computed(() => {
  const time = times.value[times.value.length - 1]
  return time === undefined ? '' : new Date(time).toLocaleTimeString('zh-CN', { hour12: false })
})
const memTotal = computed(() => props.node.mem_total || props.status?.ram_total || 0)
const diskTotal = computed(() => props.node.disk_total || props.status?.disk_total || 0)
const swapTotal = computed(() => props.node.swap_total || props.status?.swap_total || 0)

const charts = computed(() => {
  const r = activeRecords.value
  return [
    {
      title: 'CPU',
      icon: 'chip',
      max: 100,
      fmt: (v: number) => `${v.toFixed(1)}%`,
      series: [
        { name: 'CPU', color: '#4cc3ff', values: r.map((x) => x.cpu) },
        {
          name: '负载', color: '#9b7bff', axis: 'right' as const, minStep: 0.01,
          fmt: (v: number) => v.toFixed(2), values: r.map((x) => x.load),
        },
      ],
    },
    {
      title: '内存',
      icon: 'ram',
      fmt: (v: number) => bytes(v),
      series: [
        { name: '内存', color: '#ff7aa8', values: r.map((x) => x.ram) },
        ...(swapTotal.value > 0 ? [{ name: 'Swap', color: '#ffc94a', values: r.map((x) => x.swap ?? null) }] : []),
      ],
    },
    {
      title: '硬盘',
      icon: 'disk',
      fmt: (v: number) => bytes(v),
      series: [{ name: '硬盘', color: '#3fd08f', values: r.map((x) => x.disk) }],
    },
    {
      title: '网络',
      icon: 'wave',
      fmt: (v: number) => speed(v),
      series: [
        { name: '上行', color: '#ff8a5c', values: r.map((x) => x.net_out) },
        { name: '下行', color: '#3fd08f', values: r.map((x) => x.net_in) },
      ],
    },
    {
      title: '连接数',
      icon: 'link',
      fmt: (v: number) => v.toFixed(0),
      series: [
        { name: 'TCP', color: '#4cc3ff', values: r.map((x) => x.connections) },
        { name: 'UDP', color: '#ff7aa8', values: r.map((x) => x.connections_udp) },
      ],
    },
    {
      title: '进程数',
      icon: 'list',
      fmt: (v: number) => v.toFixed(0),
      series: [{ name: '进程', color: '#3fd08f', values: r.map((x) => x.process) }],
    },
  ]
})

const s = computed(() => props.status)
const info = computed(() => {
  const n = props.node
  const st = s.value
  type Row = { k: string; icon: string; v?: string; up?: string; down?: string; flag?: string }
  const rows: Row[] = [
    { k: 'CPU', icon: 'chip', v: `${n.cpu_name || '未知'} · ${n.cpu_cores} 核` },
    { k: '架构', icon: 'gear', v: `${n.arch} · ${n.virtualization || '物理机'}` },
    { k: '系统', icon: 'list', v: osShort(n.os) },
    { k: '内核', icon: 'gear', v: n.kernel_version || '—' },
    { k: '位置', icon: 'pin', v: props.place || '未知海域', flag: n.region },
    { k: '内存', icon: 'ram', v: `${bytes(st?.ram)} / ${bytes(memTotal.value)}` },
    { k: 'Swap', icon: 'swap', v: n.swap_total ? `${bytes(st?.swap)} / ${bytes(n.swap_total)}` : '无' },
    { k: '硬盘', icon: 'disk', v: `${bytes(st?.disk)} / ${bytes(diskTotal.value)}` },
    { k: '实时', icon: 'wave', up: speed(st?.net_out), down: speed(st?.net_in) },
    { k: '累计', icon: 'anchor', up: bytes(st?.net_total_up), down: bytes(st?.net_total_down) },
    { k: '负载', icon: 'gauge', v: st ? `${st.load.toFixed(2)} / ${st.load5.toFixed(2)} / ${st.load15.toFixed(2)}` : '—' },
    { k: '连接', icon: 'link', v: st ? `TCP ${st.connections} · UDP ${st.connections_udp} · 进程 ${st.process}` : '—' },
    { k: '运行', icon: 'clock', v: uptime(st?.uptime) },
    { k: '上报', icon: 'heart', v: ago(st?.time) },
  ]
  return rows
})
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <section class="panel" role="dialog" aria-modal="true" :aria-label="node.name">
      <header class="collar">
        <span v-if="node.region" class="flag">{{ node.region }}</span>
        <Icon v-else name="island" size="34px" />
        <div class="title">
          <small>Log · 观测记录</small>
          <h2>{{ node.name }}</h2>
        </div>
        <span class="badge" :class="s?.online ? 'on' : 'off'">{{ s?.online ? '在线' : '离线' }}</span>
        <button class="close" type="button" aria-label="关闭" @click="emit('close')"><Icon name="close" size="22px" /></button>
      </header>

      <div class="body">
        <aside class="side">
          <div class="treasure" :class="{ sunk: !s?.online }">
            <template v-if="s?.online">
              <img v-if="!opened" key="peek" :src="peek" alt="" class="chest peek" />
              <img v-else key="cheer" :src="cheer" alt="" class="chest cheer" />
              <span v-if="opened" class="chest-tag">打捞成功！</span>
            </template>
            <template v-else>
              <Sprite name="sink" :height="104" :speed="0.9" class="chest-sink" />
              <span class="chest-tag sad">还在海底……</span>
            </template>
          </div>
          <p class="say">{{ line }}</p>
          <dl class="info">
            <template v-for="r in info" :key="r.k">
              <dt><Icon :name="r.icon" size="15px" />{{ r.k }}</dt>
              <dd v-if="r.up !== undefined" class="updown">
                <span><Icon name="up" size="14px" />{{ r.up }}</span>
                <span><Icon name="down" size="14px" />{{ r.down }}</span>
              </dd>
              <dd v-else><span v-if="r.flag" class="mini-flag">{{ r.flag }}</span>{{ r.v }}</dd>
            </template>
          </dl>
          <p v-if="node.public_remark" class="remark">{{ node.public_remark }}</p>
        </aside>

        <div class="main">
          <div class="toolbar">
            <div class="tabs" role="group" aria-label="历史记录时间范围">
              <button
                v-for="r in RANGES"
                :key="r.h"
                type="button"
                :class="{ active: hours === r.h }"
                :aria-pressed="hours === r.h"
                @click="hours = r.h"
              >
                {{ r.label }}
              </button>
            </div>
            <span class="hint" role="status">
              <template v-if="loading">打捞中……</template>
              <template v-else-if="!err && lastRecordTime">{{ hours === 0 ? '实时上报' : '最近记录' }} {{ lastRecordTime }}</template>
            </span>
          </div>
          <div v-if="err" class="record-error" role="alert">
            <span>记录加载失败 · {{ err }}</span>
            <button type="button" @click="load()">重试</button>
          </div>
          <div class="charts">
            <PingPanel :uuid="node.uuid" :hours="hours" />
            <Chart
              v-for="c in charts"
              :key="c.title"
              :title="c.title"
              :icon="c.icon"
              :series="c.series"
              :times="times"
              :max="c.max"
              :fmt="c.fmt"
              :loading="loading"
              :error="err"
              :empty-text="hours === 0 ? '等待探针实时上报……' : undefined"
            />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(10, 30, 60, 0.45);
  backdrop-filter: blur(4px);
  animation: fade 0.2s ease;
  overflow-y: auto;
}
.panel {
  display: flex;
  flex-direction: column;
  width: min(1240px, 100%);
  min-height: 0;
  max-height: calc(100vh - 36px);
  max-height: calc(100dvh - 36px);
  overflow: hidden;
  background: var(--paper);
  color: var(--text);
  border: 3px solid var(--ink);
  border-radius: 26px;
  box-shadow: 0 8px 0 var(--ink);
  animation: rise 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.collar {
  flex: none;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px 20px;
  background: var(--collar);
  color: #fff;
  border-bottom: 3px solid var(--ink);
  box-shadow:
    inset 0 -9px 0 var(--collar),
    inset 0 -13px 0 #fff;
}
.flag {
  flex: none;
  font-size: 30px;
}
.title {
  flex: 1;
  min-width: 0;
}
.title small {
  opacity: 0.85;
  letter-spacing: 0.1em;
  font-size: 12px;
}
.title h2 {
  margin: 0;
  font-size: 22px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.25);
}
.badge {
  flex: none;
  white-space: nowrap;
  padding: 2px 12px;
  font-size: 13px;
  font-weight: 700;
  border: 2px solid var(--ink);
  border-radius: 999px;
}
.badge.on {
  background: var(--ok);
  color: #10351f;
}
.badge.off {
  background: #c9ced8;
  color: #3b4250;
}
.close {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex: none;
  padding: 0;
  color: var(--ink);
  background: var(--paper);
  border: 2.5px solid var(--ink);
  border-radius: 50%;
  box-shadow: 0 3px 0 var(--ink);
  cursor: pointer;
}
.close:active {
  transform: translateY(2px);
  box-shadow: 0 1px 0 var(--ink);
}
.body {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  min-height: 0;
  gap: 18px;
  padding: 20px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  overscroll-behavior: contain;
}
.side,
.main {
  min-width: 0;
}
.treasure {
  position: relative;
  aspect-ratio: 560 / 269;
  overflow: hidden;
  background: linear-gradient(to bottom, var(--sky-top), var(--sky-bottom));
  border: 3px solid var(--ink);
  border-radius: 18px;
  box-shadow: 0 5px 0 var(--ink);
}
.treasure.sunk {
  display: grid;
  place-items: center;
  background: linear-gradient(to bottom, var(--sea-top), var(--sea-bottom));
}
.chest {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.chest.peek {
  animation: peekup 0.9s ease-in-out infinite alternate;
}
.chest.cheer {
  animation: burst 0.5s cubic-bezier(0.34, 1.7, 0.64, 1);
}
.chest-sink {
  animation: sinkbob 2.4s ease-in-out infinite;
}
.chest-tag {
  position: absolute;
  right: 8px;
  bottom: 6px;
  padding: 1px 10px;
  font-size: 13px;
  font-weight: 700;
  color: #4a2c1a;
  background: #ffd84a;
  border: 2.5px solid var(--ink);
  border-radius: 999px;
  transform: rotate(-4deg);
  animation: burst 0.5s cubic-bezier(0.34, 1.7, 0.64, 1) 0.15s backwards;
}
.chest-tag.sad {
  background: #c9ced8;
  color: #3b4250;
}
.say {
  position: relative;
  margin: 14px 0;
  padding: 8px 12px;
  font-size: 13px;
  background: var(--paper-2);
  border: 2px solid var(--ink);
  border-radius: 14px;
}
.say::before {
  content: '';
  position: absolute;
  left: 22px;
  top: -9px;
  width: 12px;
  height: 12px;
  background: var(--paper-2);
  border-left: 2px solid var(--ink);
  border-top: 2px solid var(--ink);
  transform: rotate(45deg);
}
@keyframes peekup {
  from {
    transform: translateY(6px);
  }
  to {
    transform: translateY(-2px);
  }
}
@keyframes burst {
  from {
    transform: scale(0.7);
    opacity: 0;
  }
}
@keyframes sinkbob {
  0%,
  100% {
    transform: translateY(-4px) rotate(-3deg);
  }
  50% {
    transform: translateY(6px) rotate(3deg);
  }
}
.info {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 6px 12px;
  margin: 0;
  padding: 12px 14px;
  font-size: 13px;
  background: var(--paper-2);
  border: 2px solid var(--line);
  border-radius: 16px;
}
.info dt {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--muted);
  white-space: nowrap;
}
.updown {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
}
.updown span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.mini-flag {
  margin-right: 4px;
}
.info dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}
.remark {
  margin: 12px 0 0;
  padding: 10px 12px;
  font-size: 13px;
  border: 2px dashed var(--line);
  border-radius: 14px;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 12px;
  margin-bottom: 14px;
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tabs button {
  padding: 5px 14px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--text);
  background: var(--paper);
  border: 2.5px solid var(--ink);
  border-radius: 999px;
  box-shadow: 0 3px 0 var(--ink);
  cursor: pointer;
}
.tabs button.active {
  background: var(--collar);
  color: #fff;
}
.hint {
  font-size: 12px;
  color: var(--muted);
}
.record-error {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
  color: var(--bad);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.record-error button {
  padding: 3px 10px;
  border: 2px solid var(--ink);
  border-radius: 999px;
  color: var(--text);
  background: var(--paper-2);
  cursor: pointer;
}
.charts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
@media (max-width: 860px) {
  .body {
    grid-template-columns: minmax(0, 1fr);
  }
  .side {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
    align-content: start;
    gap: 14px;
  }
  .treasure {
    align-self: end;
  }
  .info {
    grid-column: 2;
    grid-row: 1 / span 3;
  }
  .say,
  .remark {
    grid-column: 1;
    margin: 0;
  }
}
@media (max-width: 620px) {
  .backdrop {
    padding: 8px;
  }
  .panel {
    max-height: calc(100vh - 16px);
    max-height: calc(100dvh - 16px);
    border-radius: 20px;
  }
  .collar {
    gap: 8px;
    padding: 12px 12px 20px;
  }
  .title h2 {
    font-size: 18px;
  }
  .flag {
    font-size: 24px;
  }
  .badge {
    padding-inline: 8px;
    font-size: 12px;
  }
  .close {
    width: 34px;
    height: 34px;
  }
  .body {
    gap: 20px;
    padding: 14px 12px;
  }
  .side {
    display: block;
  }
  .say {
    margin: 14px 0;
  }
  .remark {
    margin-top: 12px;
  }
  .charts {
    grid-template-columns: minmax(0, 1fr);
  }
}
@keyframes fade {
  from {
    opacity: 0;
  }
}
@keyframes rise {
  from {
    transform: translateY(30px) scale(0.96);
    opacity: 0;
  }
}
</style>
