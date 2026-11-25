// SÓ DESENVOLVIMENTO: grava a intro (envelope → “My Love” na areia → hero) em MP4 pelo Chrome headless (screencast do DevTools).
// Uso: node tools/dev/record-intro.mjs <largura> <altura> [segundos=17] [extra da URL, ex. "&debug=1"] [nome]
//      → docs/video/intro-<largura>.mp4 (+ relatório: erros, 404, modo, Δ do M/L na passagem, fps durante a intro)
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CANDIDATES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [W = 1440, H = 900, SECS = 17, EXTRA = '', NAME = ''] = process.argv.slice(2);
const name = NAME || 'intro-' + W;
const browser = CANDIDATES.find(p => fs.existsSync(p));
const port = 9300 + Math.floor(Math.random() * 500);
const profile = path.join(ROOT, 'node_modules', '.cache', 'rec-' + port);
const GPU = process.env.GPU === '1', NOREC = process.env.NOREC === '1';   /* GPU=1: GPU real (D3D11) · NOREC=1: só mede, sem gravar */
const proc = spawn(browser, ['--headless=new', '--hide-scrollbars', ...(process.env.NOGL === '1' ? ['--disable-3d-apis', '--disable-webgl'] : GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader']), `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const log = { errors: [], http: [] }, frames = [];
const tmp = path.join(ROOT, 'node_modules', '.cache', 'rec-frames-' + port);
fs.mkdirSync(tmp, { recursive: true });
try {
  let list = [];
  for (let i = 0; i < 50; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (list.length) break; } catch (e) {} await sleep(200); }
  const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Page.screencastFrame') {
      const f = path.join(tmp, String(frames.length).padStart(5, '0') + '.jpg');
      fs.writeFileSync(f, Buffer.from(m.params.data, 'base64')); frames.push({ f, ts: m.params.metadata.timestamp });
      ws.send(JSON.stringify({ id: ++id, method: 'Page.screencastFrameAck', params: { sessionId: m.params.sessionId } }));
    }
    if (m.method === 'Runtime.exceptionThrown') log.errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0] || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') log.errors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) log.http.push(m.params.response.status + ' ' + m.params.response.url);
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') log.errors.push(m.params.entry.text + ' ' + (m.params.entry.url || ''));
  };
  const evalJS = async e => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result?.result?.value; };
  await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: 1, mobile: +W < 768 });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Log.enable');
  /* mede fps só enquanto a intro roda */
  if (!NOREC) await send('Page.startScreencast', { format: 'jpeg', quality: 82, maxWidth: +W, maxHeight: +H, everyNthFrame: 1 });
  await send('Page.navigate', { url: `http://localhost:5178/tools/dev/motion.html?open=1${EXTRA}` });
  /* mede fps só enquanto a intro roda (o harness reescreve o documento: registra depois do carregamento) */
  await sleep(1300);
  await evalJS("window.__fr=[];(function w(){if(!document.body||!window.WDI){return setTimeout(w,50)}document.addEventListener('wd:open',function(){var l=0;(function f(t){if(l)__fr.push(t-l);l=t;if(!window.__stopFr)requestAnimationFrame(f)})(performance.now());document.addEventListener('wd:intro-done',function(){window.__stopFr=1})})})();1");
  await sleep(+SECS * 1000 - 1300);
  if (!NOREC) await send('Page.stopScreencast');
  const gpu = await evalJS("(function(){try{var g=document.createElement('canvas').getContext('webgl');var e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):'?'}catch(x){return 'sem webgl'}})()");
  const rep = await evalJS(`(function(){var f=(window.__fr||[]).slice().sort(function(a,b){return a-b}),q=function(p){return Math.round(f[Math.floor(f.length*p)]||0)};
    return {mode:window.WDI&&WDI.debug!==undefined?'ok':'-',debug:window.WDI&&WDI.debug,frames:f.length,p50:q(.5),p95:q(.95),max:Math.round(f[f.length-1]||0),fps:f.length?Math.round(1000/(f.reduce(function(a,b){return a+b},0)/f.length)):0,
    intro:document.body.className,names:(function(){var r=document.querySelector('#wd-heroTitle .wd-line > span').getBoundingClientRect();return [Math.round(r.left),Math.round(r.top)]})()}})()`);
  ws.close();
  if (NOREC) { console.log(JSON.stringify({ gpu, rep, errors: log.errors, http: log.http }, null, 1)); process.exit(0); }
  /* MP4 com as durações reais de cada quadro */
  const list2 = frames.map((fr, i) => `file '${fr.f.replace(/\\/g, '/')}'\nduration ${(((frames[i + 1]?.ts ?? fr.ts + 1 / 30) - fr.ts)).toFixed(4)}`).join('\n') + `\nfile '${frames[frames.length - 1].f.replace(/\\/g, '/')}'`;
  const lf = path.join(tmp, 'list.txt'); fs.writeFileSync(lf, list2);
  const outDir = path.join(ROOT, 'docs', 'video'); fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, name + '.mp4');
  const ff = path.join(ROOT, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
  execFileSync(ff, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lf, '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-c:v', 'libx264', '-crf', '22', '-movflags', '+faststart', out]);
  console.log(JSON.stringify({ out: path.relative(ROOT, out), gpu, frames: frames.length, rep, errors: log.errors, http: log.http }, null, 1));
} finally { proc.kill(); await sleep(400); try { fs.rmSync(profile, { recursive: true, force: true }); fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {} }
