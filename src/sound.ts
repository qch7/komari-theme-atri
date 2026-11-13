import highSpec from './assets/voice/voice_high_spec.mp3?url'
import titleCall from './assets/voice/voice_title_call.mp3?url'
import clear from './assets/voice/voice_clear_short.mp3?url'
import start from './assets/voice/voice_game_start_short.mp3?url'
import rocket from './assets/voice/voice_rocket_punch_type1.mp3?url'
import rocket2 from './assets/voice/voice_rocket_punch_type2.mp3?url'
import jump from './assets/voice/voice_jump_ya.mp3?url'
import damage from './assets/voice/voice_damage_short.mp3?url'
import gameOver from './assets/voice/voice_game_over_short.mp3?url'
import decide from './assets/voice/decide_button.mp3?url'

export const VOICES = {
  poke: [highSpec, titleCall, clear, start, jump],
  punch: [rocket, rocket2],
  sad: [damage, gameOver],
  crab: [jump, decide],
  ui: [decide],
}

let current: HTMLAudioElement | null = null

export function playVoice(urls: string[], volume = 0.7) {
  const url = urls[Math.floor(Math.random() * urls.length)]
  try {
    current?.pause()
    current = new Audio(url)
    current.volume = volume
    void current.play().catch(() => {})
  } catch {
    /* audio unsupported */
  }
}
