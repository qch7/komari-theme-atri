import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

// Dev-only /api proxy built on fetch: Vite's http-proxy kept stalling on Cloudflare keep-alive sockets
function komariApi(target: string): Plugin {
  return {
    name: 'komari-api-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res) => {
        try {
          const body =
            req.method === 'GET' || req.method === 'HEAD'
              ? undefined
              : await new Promise<Buffer>((ok) => {
                  const chunks: Buffer[] = []
                  req.on('data', (c) => chunks.push(c))
                  req.on('end', () => ok(Buffer.concat(chunks)))
                })
          const r = await fetch(`${target}/api${req.url}`, {
            method: req.method,
            body,
            headers: { 'content-type': String(req.headers['content-type'] || 'application/json'), origin: target },
            signal: AbortSignal.timeout(20000),
          })
          res.statusCode = r.status
          res.setHeader('content-type', r.headers.get('content-type') || 'application/json')
          res.end(Buffer.from(await r.arrayBuffer()))
        } catch (e) {
          res.statusCode = 502
          res.end(JSON.stringify({ status: 'error', message: String(e) }))
        }
      })
    },
  }
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'KOMARI_')
  const target = env.KOMARI_TARGET || 'http://127.0.0.1:25774'
  return {
    // Komari serves dist/index.html at the site root and maps /themes/{short}/ to the theme folder
    base: command === 'build' ? '/themes/ATRI/dist/' : '/',
    plugins: [vue(), komariApi(target)],
    build: {
      outDir: 'dist',
      assetsInlineLimit: 0,
      chunkSizeWarningLimit: 900,
    },
  }
})
