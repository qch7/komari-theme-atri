import { createApp } from 'vue'
import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill'
import flagFont from './assets/fonts/TwemojiCountryFlags.woff2?url'
import './style.css'
import App from './App.vue'

// Windows has no flag emoji glyphs; load a flags-only font when needed
polyfillCountryFlagEmojis('Twemoji Country Flags', flagFont)

createApp(App).mount('#app')
