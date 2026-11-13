<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import wave from '../assets/atri/atri_wave.webp'
import happy from '../assets/atri/atri_happy.webp'
import cry from '../assets/atri/atri_cry.webp'
import punch from '../assets/atri/atri_punch.webp'
import Icon from './Icon.vue'
import type { Mood } from '../types'

const props = defineProps<{ mood: Mood; pool: string[]; poolKey: string }>()
const emit = defineEmits<{ poke: [] }>()

const IMGS: Record<Mood, string> = { normal: wave, happy, cry, punch }
const tempMood = ref<Mood | null>(null)
const curMood = computed<Mood>(() => tempMood.value || props.mood)
const text = ref('')
const shown = ref('')
const done = ref(true)
let typer = 0
let rotateTimer = 0
let moodTimer = 0
let idx = 0
let lastLine = ''

function type(line: string) {
  clearInterval(typer)
  text.value = line
  shown.value = ''
  done.value = false
  let i = 0
  const chars = Array.from(line)
  typer = window.setInterval(() => {
    i++
    shown.value = chars.slice(0, i).join('')
    if (i >= chars.length) {
      clearInterval(typer)
      done.value = true
    }
  }, 38)
  lastLine = line
  scheduleNext()
}

function scheduleNext() {
  clearTimeout(rotateTimer)
  rotateTimer = window.setTimeout(next, 6000 + text.value.length * 140)
}

function next() {
  if (!done.value) {
    clearInterval(typer)
    shown.value = text.value
    done.value = true
    scheduleNext()
    return
  }
  const pool = props.pool.length ? props.pool : ['……']
  let line = pool[idx % pool.length]
  idx++
  if (line === lastLine && pool.length > 1) {
    line = pool[idx % pool.length]
    idx++
  }
  type(line)
}

function say(line: string, mood?: Mood, ms = 3500) {
  if (mood) {
    tempMood.value = mood
    clearTimeout(moodTimer)
    moodTimer = window.setTimeout(() => (tempMood.value = null), ms)
  }
  type(line)
}

defineExpose({ say })

watch(
  () => props.poolKey,
  () => {
    idx = 0
    next()
  },
)

onMounted(() => next())
onBeforeUnmount(() => {
  clearInterval(typer)
  clearTimeout(rotateTimer)
  clearTimeout(moodTimer)
})
</script>

<template>
  <div class="atri" :class="curMood">
    <button class="atri-mascot" type="button" aria-label="戳一戳亚托莉" @click="emit('poke')">
      <span class="mascot-shadow" />
      <img :key="curMood" :src="IMGS[curMood]" class="mascot-img" alt="亚托莉" draggable="false" />
      <span v-if="curMood === 'cry'" class="tear t1" />
      <span v-if="curMood === 'cry'" class="tear t2" />
      <Icon v-if="curMood === 'happy'" name="star" size="26px" class="spark s1" />
      <Icon v-if="curMood === 'happy'" name="star" size="18px" class="spark s2" />
      <Icon v-if="curMood === 'happy'" name="heart" size="20px" class="spark s3" />
      <span v-if="curMood === 'punch'" class="speedlines" />
    </button>
    <div class="vn-box" role="status" aria-live="polite" @click="next">
      <div class="vn-name">亚托莉<small>ATRI</small></div>
      <p class="vn-text">
        {{ shown }}<Icon v-if="done" name="caret" size="14px" class="vn-caret" />
      </p>
    </div>
  </div>
</template>

<style scoped>
.atri {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}
.atri-mascot {
  position: relative;
  align-self: flex-end;
  overflow: visible;
  margin: 0 8px -26px 0;
  width: min(250px, 58%);
  aspect-ratio: 508 / 402;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  z-index: 2;
  -webkit-tap-highlight-color: transparent;
}
.mascot-img {
  position: absolute;
  inset: auto 0 0 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: bottom center;
  filter: drop-shadow(0 0 0 #fff) drop-shadow(3px 0 0 #fff) drop-shadow(-3px 0 0 #fff) drop-shadow(0 3px 0 #fff)
    drop-shadow(0 -3px 0 #fff);
  animation:
    pop 0.45s cubic-bezier(0.34, 1.7, 0.64, 1),
    bob 3.2s ease-in-out 0.45s infinite;
  transform-origin: 50% 100%;
  user-select: none;
}
.happy .mascot-img {
  animation:
    pop 0.45s cubic-bezier(0.34, 1.7, 0.64, 1),
    hop 0.55s ease-in-out 0.45s infinite;
}
.cry .mascot-img {
  animation:
    pop 0.45s cubic-bezier(0.34, 1.7, 0.64, 1),
    sob 1.4s ease-in-out 0.45s infinite;
}
.atri-mascot:hover .mascot-img {
  filter: drop-shadow(0 0 0 #fff) drop-shadow(3px 0 0 #fff) drop-shadow(-3px 0 0 #fff) drop-shadow(0 3px 0 #fff)
    drop-shadow(0 -3px 0 #fff) brightness(1.05);
}
.mascot-shadow {
  position: absolute;
  left: 30%;
  right: 30%;
  bottom: 2px;
  height: 12px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.18);
}
.tear {
  position: absolute;
  width: 8px;
  height: 12px;
  background: #7fd6ff;
  border: 2px solid var(--ink);
  border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  animation: tear 1.1s ease-in infinite;
}
.t1 {
  left: calc(40% - 4px);
  top: 57%;
}
.t2 {
  left: calc(57% - 4px);
  top: 51%;
  animation-delay: 0.5s;
}
.spark {
  position: absolute;
  animation: twinkle 0.9s ease-in-out infinite;
}
.s3 {
  left: 18%;
  top: 2%;
  animation-delay: 0.2s;
}
.punch .mascot-img {
  animation:
    pop 0.3s cubic-bezier(0.34, 1.7, 0.64, 1),
    punch 0.5s ease-in-out 0.3s infinite;
}
.speedlines {
  position: absolute;
  left: -40%;
  top: 30%;
  width: 60%;
  height: 40%;
  background: repeating-linear-gradient(to bottom, transparent 0 9px, var(--ink) 9px 12px, transparent 12px 22px);
  -webkit-mask-image: linear-gradient(to right, transparent, #000 60%, transparent);
  mask-image: linear-gradient(to right, transparent, #000 60%, transparent);
  opacity: 0.55;
  animation: speed 0.25s linear infinite;
}
@keyframes punch {
  0%,
  100% {
    transform: translateX(0);
  }
  40% {
    transform: translateX(14px) rotate(-2deg);
  }
}
@keyframes speed {
  from {
    transform: translateX(10px);
  }
  to {
    transform: translateX(-10px);
  }
}
.s1 {
  left: 6%;
  top: 10%;
}
.s2 {
  right: 4%;
  top: 22%;
  animation-delay: 0.4s;
}
.vn-box {
  position: relative;
  min-height: 112px;
  padding: 26px 22px 18px;
  background: var(--vn-bg);
  border: 3px solid var(--ink);
  border-radius: 20px;
  box-shadow:
    inset 0 0 0 3px var(--vn-inner),
    0 6px 0 var(--ink);
  cursor: pointer;
  backdrop-filter: blur(6px);
}
.vn-name {
  position: absolute;
  top: -17px;
  left: 18px;
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 3px 16px 4px;
  background: var(--ribbon);
  color: #fff;
  font-weight: 700;
  font-size: 15px;
  border: 3px solid var(--ink);
  border-radius: 12px;
  letter-spacing: 0.08em;
}
.vn-name small {
  font-size: 11px;
  opacity: 0.85;
  letter-spacing: 0.15em;
}
.vn-text {
  margin: 0;
  font-size: 16px;
  line-height: 1.75;
  color: var(--text);
  min-height: 3.5em;
}
.vn-caret {
  margin-left: 6px;
  vertical-align: -0.05em;
  animation: caret 0.9s ease-in-out infinite;
}
@keyframes pop {
  0% {
    transform: scale(0.6) translateY(20px);
    opacity: 0;
  }
  100% {
    transform: none;
    opacity: 1;
  }
}
@keyframes bob {
  0%,
  100% {
    transform: translateY(0) rotate(0);
  }
  50% {
    transform: translateY(-6px) rotate(-1deg);
  }
}
@keyframes hop {
  0%,
  100% {
    transform: translateY(0) scale(1, 1);
  }
  40% {
    transform: translateY(-16px) scale(0.98, 1.03);
  }
  80% {
    transform: translateY(0) scale(1.04, 0.96);
  }
}
@keyframes sob {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-2px) rotate(-1deg);
  }
  75% {
    transform: translateX(2px) rotate(1deg);
  }
}
@keyframes tear {
  0% {
    transform: translateY(0) scale(0.6);
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  100% {
    transform: translateY(40px) scale(1);
    opacity: 0;
  }
}
@keyframes twinkle {
  0%,
  100% {
    transform: scale(0.6) rotate(0);
    opacity: 0.4;
  }
  50% {
    transform: scale(1.2) rotate(30deg);
    opacity: 1;
  }
}
@keyframes caret {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(3px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .mascot-img,
  .happy .mascot-img,
  .cry .mascot-img {
    animation: none;
  }
}
</style>
