// SÓ DESENVOLVIMENTO: capturas do site com o Chrome headless via protocolo DevTools (tempo real, WebGL).
// Uso: node tools/dev/shot.mjs <nome> [largura] [altura] [scroll 0–1] [espera ms]   → tools/review/<nome>.png
// Requer o servidor local rodando (npm run serve). Exporta também capture() para outros scripts.
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CANDIDATES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function capture({ name = 'shot', w = 1440, h = 900, scroll = '', wait = 9000, evaluate = null, url = null, reducedMotion = false }) {
  const browser = CANDIDATES.find(p => fs.existsSync(p));
  if (!browser) throw new Error('Chrome/Edge não encontrado');
  const port = 9300 + Math.floor(Math.random() * 500);
  const profile = path.join(ROOT, 'node_modules', '.cache', 'shot-' + port);
  const proc = spawn(browser, ['--headless=new', '--hide-scrollbars', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  try {
    let list = [];
    for (let i = 0; i < 50; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (list.length) break; } catch (e) {} await sleep(200); }
    const page = list.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0; const pending = new Map();
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: +w < 768 });
    await send('Page.enable');
    if (reducedMotion) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    const target = url || `http://localhost:5178/tools/dev/motion.html?open=1${scroll !== '' ? '&scroll=' + scroll : ''}`;
    await send('Page.navigate', { url: target });
    await sleep(+wait);
    let result = null;
    if (evaluate) { const r = await send('Runtime.evaluate', { expression: evaluate, returnByValue: true, awaitPromise: true }); result = r.result && r.result.result ? r.result.result.value : r; }
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const out = path.join(ROOT, 'tools', 'review', name + '.png');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
    ws.close();
    return { out, result };
  } finally {
    proc.kill();
    await sleep(400);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [name, w, h, scroll = '', wait] = process.argv.slice(2);
  const { out } = await capture({ name, w, h, scroll, wait: wait || 9000 });
  console.log(out);
}
