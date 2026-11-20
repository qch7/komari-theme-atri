<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getNodePing, type PingRecord, type PingTask } from '../api'
import { buildPingLines, latencyLevel, lossLevel, lossText, ms, type Beat } from '../ping'
import Chart from './Chart.vue'
import Icon from './Icon.vue'
import Sprite from './Sprite.vue'

const props = defineProps<{ uuid: string; hours: number }>()

const tasks = ref<PingTask[]>([])
const records = ref<PingRecord[]>([])
const loading = ref(false)
const loaded = ref(false)
const err = ref('')
let timer = 0
let requestId = 0

// the realtime tab still shows the last hour: probes run every 30–60 s
const span = computed(() => props.hours || 1)

async function load(reset = false) {
  const id = ++requestId
  if (reset) {
    records.value = []
    tasks.value = []
    loaded.value = false
  }
  loading.value = true
  err.value = ''
  try {
    const r = await getNodePing(props.uuid, span.value)
    if (id !== requestId) return
    tasks.value = r.tasks
    records.value = r.records
  } catch (e) {
    if (id !== requestId) return
    err.value = (e as Error).message
  } finally {
    if (id === requestId) {
      loading.value = false
      loaded.value = true
    }
  }
}

watch(() => [props.uuid, span.value], () => load(true))
onMounted(() => {
  load()
  timer = window.setInterval(() => {
    if (!loading.value && !document.hidden) load()
  }, 30000)
})
onBeforeUnmount(() => {
  requestId++
  clearInterval(timer)
})

const built = computed(() => buildPingLines(records.value, tasks.value, span.value))
const lines = computed(() => built.value.lines)
const empty = computed(() => loaded.value && !err.value && !lines.value.length)
const series = computed(() => lines.value.map((l) => ({ name: l.name, color: l.color, values: l.values })))

function beatTitle(b: Beat) {
  const t = (x: number) => new Date(x).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' })
  if (!b.total) return `${t(b.from)}–${t(b.to)} · 无记录`
  return `${t(b.from)}–${t(b.to)} · 平均 ${ms(b.avg)} · 丢包 ${b.lost}/${b.total}`
}

const typeLabel = (type: string) => (type ? type.toUpperCase() : '')
</script>

<template>
  <section class="ping" aria-label="延迟监测">
    <div v-if="empty" class="ping-empty">
      <Sprite name="swim" :height="64" class="ping-empty-atri" />
      <div>
        <b><Icon name="sonar" size="18px" />声呐还没有对准这台服务器</b>
        <small>在 Komari 后台「延迟监测」里添加任务并勾选它，亚托莉就会把延迟画在这里。</small>
      </div>
    </div>
    <template v-else>
      <div class="ping-list">
        <h3 class="ping-title">
          <Icon name="sonar" size="18px" />延迟监测
          <small>{{ hours === 0 ? '最近 1 小时' : `最近 ${hours} 小时` }}</small>
        </h3>
        <p v-if="err" class="ping-msg bad" role="alert">
          延迟记录加载失败 · {{ err }} <button type="button" @click="load()">重试</button>
        </p>
        <p v-else-if="!loaded" class="ping-msg">声呐探测中……</p>
        <ul v-else>
          <li v-for="l in lines" :key="l.id" class="ping-row">
            <div class="ping-name">
              <i :style="{ background: l.color }" />
              <b :title="l.name">{{ l.name }}</b>
              <span v-if="l.type" class="ping-type">{{ typeLabel(l.type) }}</span>
            </div>
            <div class="ping-stats">
              <span>平均 <b :class="l.avg === null ? '' : latencyLevel(l.avg)">{{ ms(l.avg) }}</b></span>
              <span v-if="l.min !== null">{{ Math.round(l.min) }}–{{ Math.round(l.max ?? l.min) }}</span>
              <span>丢包 <b :class="lossLevel(l.loss)">{{ lossText(l.loss) }}</b></span>
            </div>
            <div class="beats" role="img" :aria-label="`${l.name} 丢包时间线`">
              <span v-for="(b, i) in l.beats" :key="i" :class="b.level" :title="beatTitle(b)" />
            </div>
          </li>
        </ul>
        <div v-if="loaded && lines.length" class="ping-key" aria-hidden="true">
          <span><i class="ok" />正常</span><span><i class="warn" />少量丢包</span><span><i class="bad" />严重丢包</span>
        </div>
      </div>
      <Chart
        class="ping-chart"
        title="延迟曲线"
        icon="sonar"
        :series="series"
        :times="built.times"
        :fmt="ms"
        :loading="loading && !loaded"
        :error="err"
        empty-text="这段时间还没有延迟记录……"
      />
    </template>
  </section>
</template>

<style scoped>
.ping {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
}
.ping-list,
.ping-empty {
  min-width: 0;
  padding: 12px 14px;
  background: var(--paper);
  border: 2.5px solid var(--ink);
  border-radius: 18px;
  box-shadow: 0 4px 0 var(--ink);
}
.ping-title {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 10px;
  min-height: 20px;
  font-size: 14px;
  line-height: 20px;
}
.ping-title small {
  margin-left: auto;
  color: var(--muted);
  font-size: 12px;
  font-weight: 400;
}
.ping-list ul {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.ping-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 5px 10px;
  padding: 8px 10px;
  background: var(--paper-2);
  border: 2px solid var(--line);
  border-radius: 14px;
}
.ping-name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 13px;
}
.ping-name i,
.ping-key i {
  flex: none;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1.5px solid var(--ink);
}
.ping-name b {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ping-type {
  flex: none;
  padding: 0 6px;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  color: var(--muted);
  border: 1.5px solid var(--line);
  border-radius: 999px;
  font-family: Fredoka, sans-serif;
}
.ping-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
  font-family: Fredoka, 'Microsoft YaHei UI', sans-serif;
  font-variant-numeric: tabular-nums;
}
.ping-stats b {
  color: var(--text);
  font-weight: 600;
}
.ping-stats b.ok {
  color: #1f9e63;
}
.ping-stats b.warn {
  color: #c98a00;
}
.ping-stats b.bad {
  color: var(--bad);
}
:global(.dark) .ping-stats b.ok {
  color: var(--ok);
}
:global(.dark) .ping-stats b.warn {
  color: var(--warn);
}
.beats {
  grid-column: 1 / -1;
  display: flex;
  gap: 2px;
  height: 16px;
}
.beats span {
  flex: 1;
  min-width: 2px;
  border-radius: 3px;
  background: var(--track);
  border: 1.5px solid var(--ink);
}
.beats span.ok,
.ping-key i.ok {
  background: var(--ok);
}
.beats span.warn,
.ping-key i.warn {
  background: var(--warn);
}
.beats span.bad,
.ping-key i.bad {
  background: var(--bad);
}
.beats span.none {
  opacity: 0.45;
}
.ping-key {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
  font-size: 11px;
  color: var(--muted);
}
.ping-key span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.ping-msg {
  margin: 6px 0;
  font-size: 13px;
  color: var(--muted);
}
.ping-msg.bad {
  color: var(--bad);
  overflow-wrap: anywhere;
}
.ping-msg button {
  margin-left: 6px;
  padding: 2px 10px;
  border: 2px solid var(--ink);
  border-radius: 999px;
  color: var(--text);
  background: var(--paper-2);
  cursor: pointer;
}
.ping-empty {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 12px;
}
.ping-empty b {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}
.ping-empty small {
  display: block;
  margin-top: 3px;
  color: var(--muted);
  font-size: 12px;
}
.ping-empty-atri {
  flex: none;
}
@media (max-width: 620px) {
  .ping {
    grid-template-columns: minmax(0, 1fr);
  }
  .ping-row {
    grid-template-columns: minmax(0, 1fr);
  }
  .ping-stats {
    flex-wrap: wrap;
  }
}
</style>
