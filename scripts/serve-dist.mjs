// Serves the built theme the way Komari does: dist/index.html at every non-file path,
// /themes/ATRI/* from the theme root, /api/* proxied to a live Komari instance.
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { loadEnv } from 'vite'

const ROOT = resolve(process.argv[2] || '.')
const PORT = Number(process.argv[3] || 5181)
const TARGET = loadEnv('development', ROOT, 'KOMARI_').KOMARI_TARGET || 'http://127.0.0.1:25774'
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' }

async function indexHtml() {
  let html = await readFile(join(ROOT, 'dist', 'index.html'), 'utf8')
  return html.replace('<title>Komari Monitor</title>', '<title>ATRI · Komari 本地预览</title>')
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  try {
    if (url.pathname.startsWith('/api/')) {
      const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await new Promise((ok) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c))) })
      const r = await fetch(TARGET + url.pathname + url.search, { method: req.method, body, headers: { 'content-type': req.headers['content-type'] || 'application/json', origin: TARGET } })
      res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/json' })
      return res.end(Buffer.from(await r.arrayBuffer()))
    }
    if (url.pathname.startsWith('/themes/ATRI/')) {
      const rel = normalize(decodeURIComponent(url.pathname.slice('/themes/ATRI/'.length)))
      if (rel.startsWith('..')) throw new Error('bad path')
      const data = await readFile(join(ROOT, rel))
      res.writeHead(200, { 'content-type': TYPES[extname(rel)] || 'application/octet-stream' })
      return res.end(data)
    }
    res.writeHead(200, { 'content-type': TYPES['.html'] })
    res.end(await indexHtml())
  } catch (e) {
    res.writeHead(404)
    res.end(String(e))
  }
}).listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`))
