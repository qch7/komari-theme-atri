<script setup lang="ts">
import { computed } from 'vue'
import type { NodeInfo, NodeStatus } from '../api'
import { ago, bytes, osShort, pct, speed, uptime } from '../format'
import { latencyLevel, lossText, type NodePing } from '../ping'
import punch from '../assets/atri/atri_punch.webp'
import Icon from './Icon.vue'
import Sprite from './Sprite.vue'

const props = defineProps<{ node: NodeInfo; status?: NodeStatus; place: string; ping?: NodePing[] }>()

const pings = computed(() =>
  (props.ping || []).slice(0, 3).map((p) => ({
    ...p,
    level: p.latest === null ? 'bad' : latencyLevel(p.latest),
    text: p.latest === null ? '超时' : `${Math.round(p.latest)}`,
  })),
)
const emit = defineEmits<{ open: [] }>()

const online = computed(() => !!props.status?.online)
const cpu = computed(() => Math.max(0, Math.min(100, props.status?.cpu ?? 0)))
const memTotal = computed(() => props.status?.ram_total || props.node.mem_total)
const ram = computed(() => pct(props.status?.ram, memTotal.value))
const diskTotal = computed(() => props.status?.disk_total || props.node.disk_total)
const disk = computed(() => pct(props.status?.disk, diskTotal.value))
const swapTotal = computed(() => props.status?.swap_total || props.node.swap_total)
const swap = computed(() => pct(props.status?.swap, swapTotal.value))

const traffic = computed(() => {
  const lim = props.node.traffic_limit
  if (!lim || lim <= 0 || !props.status) return null
  const up = props.status.net_total_up
  const down = props.status.net_total_down
  const used =
    {
      sum: up + down,
      max: Math.max(up, down),
      min: Math.min(up, down),
      up,
      down,
    }[props.node.traffic_limit_type] ?? up + down
  return { used, lim, p: pct(used, lim) }
})

const expire = computed(() => {
  const e = props.node.expired_at
  if (!e) return null
  const t = Date.parse(e)
  if (!t || new Date(t).getFullYear() > 2090 || t < 946684800000) return null
  const days = Math.ceil((t - Date.now()) / 86400000)
  return days
})

function level(p: number) {
  return p >= 85 ? 'bad' : p >= 60 ? 'warn' : 'ok'
}

const bars = computed(() => {
  const s = props.status
  const list = [
    { k: 'CPU', icon: 'chip', p: cpu.value, sub: `${props.node.cpu_cores || '?'} 核` },
    { k: '内存', icon: 'ram', p: ram.value, sub: `${bytes(s?.ram)} / ${bytes(memTotal.value)}` },
    { k: '硬盘', icon: 'disk', p: disk.value, sub: `${bytes(s?.disk)} / ${bytes(diskTotal.value)}` },
  ]
  if (swapTotal.value > 0 && (s?.swap ?? 0) > 0) list.push({ k: 'Swap', icon: 'swap', p: swap.value, sub: `${bytes(s?.swap)} / ${bytes(swapTotal.value)}` })
  if (traffic.value) list.push({ k: '流量', icon: 'wave', p: traffic.value.p, sub: `${bytes(traffic.value.used)} / ${bytes(traffic.value.lim)}` })
  return list
})
</script>

<template>
  <article
    class="card"
    :class="{ offline: !online, turbo: online && cpu >= 90 }"
    tabindex="0"
    role="button"
    @click="emit('open')"
    @keydown.enter="emit('open')"
  >
    <header class="collar">
      <span v-if="node.region" class="flag">{{ node.region }}</span>
      <Icon v-else name="island" size="24px" />
      <h3 class="name" :title="node.name">{{ node.name }}</h3>
      <span class="badge" :class="online ? 'on' : 'off'">{{ online ? '在线' : '离线' }}</span>
      <svg class="bow" viewBox="0 0 48 26" aria-hidden="true">
        <path
          d="M24 13 L6 3 Q1 2 2 8 L3 18 Q4 24 9 21 Z M24 13 L42 3 Q47 2 46 8 L45 18 Q44 24 39 21 Z"
          fill="var(--ribbon)"
          stroke="var(--ink)"
          stroke-width="2.4"
          stroke-linejoin="round"
        />
        <circle cx="24" cy="13" r="5" fill="var(--ribbon)" stroke="var(--ink)" stroke-width="2.4" />
      </svg>
    </header>
    <div class="meta">
      <span>{{ osShort(node.os) }}</span>
      <span>{{ node.arch }}</span>
      <span v-if="place"><Icon name="pin" size="13px" />{{ place }}</span>
    </div>

    <div class="bars">
      <div v-for="b in bars" :key="b.k" class="bar-row">
        <div class="bar-head">
          <b><Icon :name="b.icon" size="16px" />{{ b.k }}</b>
          <span class="bar-sub">{{ b.sub }}</span>
          <span class="bar-val">{{ b.p.toFixed(b.p < 10 ? 1 : 0) }}%</span>
        </div>
        <div class="bar" :class="level(b.p)">
          <i :style="{ width: `${Math.max(online ? 3 : 0, b.p)}%` }" />
        </div>
      </div>
    </div>

    <div class="net">
      <span class="up"><Icon name="up" size="16px" />{{ speed(status?.net_out) }}</span>
      <span class="down"><Icon name="down" size="16px" />{{ speed(status?.net_in) }}</span>
      <img v-if="online && cpu >= 90" :src="punch" alt="" class="turbo-atri" />
    </div>
    <ul v-if="online && pings.length" class="ping" aria-label="延迟（最近一次探测）">
      <li
        v-for="p in pings"
        :key="p.name"
        :title="`${p.name} · 最近一小时平均 ${p.avg === null ? '—' : Math.round(p.avg) + ' ms'} · 丢包 ${lossText(p.loss)}`"
      >
        <i class="ping-dot" :class="p.level" />
        <span class="ping-name">{{ p.name }}</span>
        <span class="ping-val"><b>{{ p.text }}</b><small v-if="p.latest !== null"> ms</small></span>
        <em class="ping-loss" :class="{ none: p.loss <= 0 }">丢包 {{ lossText(p.loss) }}</em>
      </li>
    </ul>
    <div class="foot">
      <span title="累计流量（上传 / 下载）"><Icon name="wave" size="15px" />{{ bytes(status?.net_total_up) }} / {{ bytes(status?.net_total_down) }}</span>
      <span title="负载"><Icon name="gauge" size="15px" />{{ (status?.load ?? 0).toFixed(2) }}</span>
      <span title="运行时间"><Icon name="clock" size="15px" />{{ uptime(status?.uptime) }}</span>
      <span v-if="expire !== null" class="expire" :class="{ soon: expire <= 7 }">
        {{ expire >= 0 ? `剩 ${expire} 天` : '已到期' }}
      </span>
    </div>

    <div v-if="online && cpu >= 90" class="turbo-tag">高性能模式！</div>
    <div v-if="!online" class="sunk">
      <Sprite name="sink" :height="78" :speed="0.9" class="sunk-atri" />
      <div>
        <b>沉入海底中……</b>
        <small>最后上报：{{ ago(status?.time) }}</small>
      </div>
    </div>
  </article>
</template>

<style scoped>
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 16px 14px;
  background: var(--paper);
  color: var(--text);
  border: 3px solid var(--ink);
  border-radius: 22px;
  box-shadow: 0 6px 0 var(--ink);
  cursor: pointer;
  overflow: hidden;
  transition:
    transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.25s;
  outline: none;
}
.card:hover,
.card:focus-visible {
  transform: translateY(-4px) rotate(-0.4deg);
  box-shadow: 0 10px 0 var(--ink);
}
.card:active {
  transform: translateY(2px);
  box-shadow: 0 3px 0 var(--ink);
}
.collar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 -16px;
  padding: 12px 16px 16px;
  background: var(--collar);
  color: #fff;
  border-bottom: 3px solid var(--ink);
  box-shadow:
    inset 0 -8px 0 var(--collar),
    inset 0 -11px 0 #fff;
}
.flag {
  font-size: 22px;
  line-height: 1;
  filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.3));
}
.name {
  flex: 1;
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.25);
}
.badge {
  flex: none;
  padding: 2px 10px;
  font-size: 12px;
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
.bow {
  position: absolute;
  left: 50%;
  bottom: -14px;
  width: 40px;
  transform: translateX(-50%);
  z-index: 1;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--muted);
}
.meta span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 8px;
  background: var(--paper-2);
  border: 1.5px solid var(--line);
  border-radius: 999px;
}
.bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bar-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12.5px;
  margin-bottom: 3px;
}
.bar-head b {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 4em;
}
.bar-sub {
  flex: 1;
  color: var(--muted);
  font-size: 11.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bar-val {
  font-family: Fredoka, sans-serif;
  font-weight: 600;
}
.bar {
  height: 14px;
  background: var(--track);
  border: 2.5px solid var(--ink);
  border-radius: 999px;
  overflow: hidden;
}
.bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  border-right: 2.5px solid var(--ink);
  background-image: repeating-linear-gradient(
    -45deg,
    rgba(255, 255, 255, 0.35) 0 6px,
    rgba(255, 255, 255, 0) 6px 12px
  );
  background-size: 34px 100%;
  animation: stripes 1.2s linear infinite;
  transition: width 0.8s cubic-bezier(0.34, 1.3, 0.64, 1);
  box-shadow: inset 0 3px 0 rgba(255, 255, 255, 0.35);
}
.bar.ok i {
  background-color: var(--bar-ok);
}
.bar.warn i {
  background-color: var(--warn);
}
.bar.bad i {
  background-color: var(--bad);
}
.net {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  font-family: Fredoka, 'Microsoft YaHei UI', sans-serif;
  font-weight: 600;
  font-size: 14px;
}
.net span {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 4px 10px;
  border: 2px solid var(--ink);
  border-radius: 12px;
  text-align: center;
  white-space: nowrap;
}
.net .up {
  background: var(--up-bg);
  color: var(--up);
}
.net .down {
  background: var(--down-bg);
  color: var(--down);
}
.ping {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 1px 8px;
  margin: 0;
  padding: 4px 10px;
  list-style: none;
  font-size: 12px;
  background: var(--paper-2);
  border: 2px solid var(--line);
  border-radius: 12px;
  font-family: Fredoka, 'Microsoft YaHei UI', sans-serif;
  font-variant-numeric: tabular-nums;
}
.ping li {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: subgrid;
  align-items: center;
  line-height: 18px;
}
.ping-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1.5px solid var(--ink);
}
.ping-dot.ok {
  background: var(--ok);
}
.ping-dot.warn {
  background: var(--warn);
}
.ping-dot.bad {
  background: var(--bad);
}
.ping-name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--muted);
}
.ping-val {
  text-align: right;
  white-space: nowrap;
}
.ping-val b {
  font-weight: 600;
}
.ping-val small {
  color: var(--muted);
  font-size: 10px;
}
.ping-loss {
  font-style: normal;
  font-size: 11px;
  color: var(--bad);
  white-space: nowrap;
}
.ping-loss.none {
  color: var(--muted);
  opacity: 0.6;
}
.foot {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  align-items: center;
  font-size: 12px;
  color: var(--muted);
}
.foot > span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.expire {
  color: var(--text);
}
.turbo-atri {
  position: absolute;
  right: -10px;
  bottom: 10px;
  width: 64px;
  filter: drop-shadow(0 3px 0 rgba(0, 0, 0, 0.2));
  animation: jab 0.45s ease-in-out infinite;
  pointer-events: none;
}
@keyframes jab {
  50% {
    transform: translateX(-6px) rotate(-3deg);
  }
}
.expire.soon {
  color: var(--bad);
  font-weight: 700;
}
.turbo {
  animation: shake 0.5s ease-in-out infinite;
}
.turbo-tag {
  position: absolute;
  right: -34px;
  top: 64px;
  padding: 2px 40px;
  background: #ffd84a;
  color: #4a2c1a;
  font-size: 11px;
  font-weight: 700;
  border-top: 2px solid var(--ink);
  border-bottom: 2px solid var(--ink);
  transform: rotate(35deg);
}
.offline > :not(.sunk) {
  filter: grayscale(0.85) opacity(0.55);
}
.sunk {
  position: absolute;
  inset: auto 10px 10px 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--paper);
  border: 2.5px solid var(--ink);
  border-radius: 16px;
  box-shadow: 0 4px 0 var(--ink);
}
.sunk-atri {
  margin: -22px 0 -6px;
}
.sunk b {
  display: block;
  font-size: 14px;
}
.sunk small {
  color: var(--muted);
}
@keyframes stripes {
  to {
    background-position: 34px 0;
  }
}
@keyframes shake {
  0%,
  100% {
    transform: rotate(0);
  }
  25% {
    transform: rotate(-0.5deg);
  }
  75% {
    transform: rotate(0.5deg);
  }
}
@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .bar i,
  .turbo,
  .sunk img {
    animation: none;
  }
}
</style>
