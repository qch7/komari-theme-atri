<script setup lang="ts">
import town from '../assets/atri/town.webp'
import crab from '../assets/atri/crab.webp'
import Sprite from './Sprite.vue'

defineProps<{ swimmer: boolean }>()
const emit = defineEmits<{ crab: []; poke: [] }>()

function wave(width: number, amp: number, len: number, base: number, h: number) {
  let d = `M0 ${base}`
  for (let x = 0; x < width; x += len) d += ` q ${len / 4} ${-amp} ${len / 2} 0 t ${len / 2} 0`
  return `${d} V ${h} H 0 Z`
}
const back = wave(2880, 10, 160, 22, 60)
const front = wave(2880, 12, 240, 28, 60)
</script>

<template>
  <div class="shore" aria-hidden="false">
    <div class="town" :style="{ backgroundImage: `url(${town})` }" />
    <div class="beach">
      <button class="crab" type="button" aria-label="伟大的螃蟹" @click="emit('crab')">
        <img :src="crab" alt="" draggable="false" />
      </button>
      <button class="walker" type="button" aria-label="追螃蟹的亚托莉" @click="emit('poke')">
        <span class="walker-flip"><Sprite name="walk" :height="74" :speed="0.45" /></span>
      </button>
    </div>
    <div class="water">
      <svg class="wave back" viewBox="0 0 2880 60" preserveAspectRatio="none"><path :d="back" /></svg>
      <button
        v-if="swimmer"
        class="swimmer"
        type="button"
        aria-label="游泳中的亚托莉"
        @click="emit('poke')"
      >
        <Sprite name="swim" :height="98" class="swim-sprite" />
        <span class="bub b1" /><span class="bub b2" /><span class="bub b3" />
      </button>
      <svg class="wave front" viewBox="0 0 2880 60" preserveAspectRatio="none"><path :d="front" /></svg>
    </div>
  </div>
</template>

<style scoped>
.shore {
  position: relative;
  margin-top: -40px;
  pointer-events: none;
}
.town {
  height: 170px;
  background-repeat: repeat-x;
  background-size: 638px 170px;
  background-position: 0 bottom;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, #000 45%);
  mask-image: linear-gradient(to bottom, transparent 0%, #000 45%);
  animation: scroll 90s linear infinite;
  filter: var(--town-filter);
}
.beach {
  position: relative;
  height: 30px;
  margin-top: -8px;
  background:
    radial-gradient(circle at 20% 60%, rgba(160, 110, 60, 0.25) 0 2px, transparent 3px) 0 0 / 46px 22px,
    var(--sand);
  border-top: 3px solid var(--ink);
}
.crab {
  position: absolute;
  bottom: 4px;
  left: 0;
  width: 62px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  pointer-events: auto;
  animation: crabwalk 26s ease-in-out infinite;
  z-index: 3;
}
.crab img {
  display: block;
  width: 100%;
  animation: scuttle 0.35s steps(2) infinite;
  filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.25));
}
.walker {
  position: absolute;
  bottom: 6px;
  left: 0;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  pointer-events: auto;
  z-index: 2;
  /* same path as the crab, 1.6 s behind it: she is chasing the crab */
  animation: crabwalk 26s ease-in-out -24.4s infinite;
}
.walker-flip {
  display: block;
  line-height: 0;
  filter: drop-shadow(0 3px 0 rgba(0, 0, 0, 0.18));
  animation: walkflip 26s steps(1, end) -24.4s infinite;
}
@keyframes walkflip {
  0% {
    transform: scaleX(1);
  }
  50% {
    transform: scaleX(-1);
  }
  100% {
    transform: scaleX(-1);
  }
}
.water {
  position: relative;
  height: 64px;
  margin-top: -16px;
}
.wave {
  position: absolute;
  left: 0;
  width: 200%;
  height: 60px;
  bottom: 0;
}
.wave path {
  stroke: var(--ink);
  stroke-width: 3;
  vector-effect: non-scaling-stroke;
}
.wave.back {
  bottom: 6px;
  animation: drift 22s linear infinite;
}
.wave.back path {
  fill: var(--sea-back);
}
.wave.front {
  animation: drift 14s linear infinite reverse;
}
.wave.front path {
  fill: var(--sea-top);
}
.swimmer {
  position: absolute;
  bottom: 14px;
  left: 0;
  width: 104px;
  height: 98px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  pointer-events: auto;
  animation:
    swimacross 38s linear infinite,
    swimbob 2.2s ease-in-out infinite;
  z-index: 1;
}
.swim-sprite {
  display: block;
  filter: drop-shadow(2px 0 0 #fff) drop-shadow(-2px 0 0 #fff) drop-shadow(0 -2px 0 #fff);
}
.bub {
  position: absolute;
  right: -6px;
  top: 14px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.6);
  border: 2px solid #7fd6ff;
  animation: bubble 1.8s ease-in infinite;
}
.b2 {
  right: -14px;
  width: 7px;
  height: 7px;
  animation-delay: 0.6s;
}
.b3 {
  right: 2px;
  width: 6px;
  height: 6px;
  animation-delay: 1.2s;
}
@keyframes scroll {
  to {
    background-position: -638px bottom;
  }
}
@keyframes drift {
  to {
    transform: translateX(-50%);
  }
}
@keyframes swimacross {
  0% {
    left: -140px;
  }
  100% {
    left: calc(100% + 40px);
  }
}
@keyframes swimbob {
  0%,
  100% {
    transform: translateY(0) rotate(-2deg);
  }
  50% {
    transform: translateY(6px) rotate(3deg);
  }
}
@keyframes crabwalk {
  0%,
  100% {
    left: 6%;
  }
  45%,
  55% {
    left: 86%;
  }
}
@keyframes scuttle {
  0% {
    transform: translateY(0) rotate(-3deg);
  }
  100% {
    transform: translateY(-2px) rotate(3deg);
  }
}
@keyframes bubble {
  0% {
    transform: translate(0, 0) scale(0.5);
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  100% {
    transform: translate(10px, -40px) scale(1.1);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .town,
  .wave,
  .swimmer,
  .crab,
  .crab img,
  .walker,
  .walker-flip {
    animation: none;
  }
}
</style>
