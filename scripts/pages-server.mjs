import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve } from 'node:path'

const base = '/lifestyle-book-mobile/'
const root = resolve('dist')
const types = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
}

createServer(async (request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
  if (!pathname.startsWith(base)) {
    response.writeHead(404).end()
    return
  }

  const relative = pathname.slice(base.length)
  let file = resolve(root, relative || 'index.html')
  if (!file.startsWith(root)) {
    response.writeHead(403).end()
    return
  }

  try {
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html')
  } catch {
    file = resolve(root, 'index.html')
  }

  response.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream')
  createReadStream(file).pipe(response)
}).listen(4173, '127.0.0.1')
