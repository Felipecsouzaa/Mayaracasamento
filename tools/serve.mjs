// Servidor estático local para testar o site (nunca abrir por file://: texturas WebGL quebram).
// Uso: npm run serve   →   http://localhost:5178/   (design system em /assets/design_system.html)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +process.env.PORT || 5178;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.svg': 'image/svg+xml', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.wasm': 'application/wasm', '.md': 'text/markdown; charset=utf-8'
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { console.log('404', p); res.writeHead(404); return res.end('404'); }
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range;                                   // áudio/vídeo pedem por faixa
    if (range) {
      const [s, e] = range.replace('bytes=', '').split('-'), start = s === '' ? Math.max(0, st.size - +e) : +s, end = s !== '' && e ? Math.min(+e, st.size - 1) : st.size - 1;
      if (!(start >= 0 && start <= end && start < st.size)) {        // faixa fora do arquivo (ex.: arquivo trocado com o navegador em cache)
        res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end();
      }
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, () => console.log(`site em http://localhost:${PORT}/  (raiz ${ROOT})`));
