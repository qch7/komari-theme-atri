<script setup lang="ts">
import { computed } from 'vue'
import swim from '../assets/atri/swim_strip.webp'
import walk from '../assets/atri/walk_strip.webp'
import sink from '../assets/atri/sink_strip.webp'

// 2-frame strips cut from the official atri_game sprite sheet; [url, frame width, frame height]
const SHEETS = {
  swim: [swim, 190, 180],
  walk: [walk, 160, 200],
  sink: [sink, 159, 200],
} as const

const props = withDefaults(defineProps<{ name: keyof typeof SHEETS; height: number; speed?: number }>(), { speed: 0.7 })

const style = computed(() => {
  const [src, fw, fh] = SHEETS[props.name]
  const w = (fw * props.height) / fh
  return {
    width: `${w}px`,
    height: `${props.height}px`,
    backgroundImage: `url(${src})`,
    backgroundSize: `${w * 2}px ${props.height}px`,
    '--dist': `${-w * 2}px`,
    animationDuration: `${props.speed}s`,
  }
})
</script>

<template>
  <span class="sprite" :style="style" aria-hidden="true" />
</template>

<style scoped>
.sprite {
  display: inline-block;
  flex: none;
  background-repeat: no-repeat;
  animation: sprite-frames 0.7s steps(2) infinite;
}
@keyframes sprite-frames {
  to {
    background-position: var(--dist) 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .sprite {
    animation: none;
  }
}
</style>
