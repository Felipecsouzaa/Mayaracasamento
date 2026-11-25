// SÓ DESENVOLVIMENTO: captura o topo do site e mede o contraste real dos links da navbar sobre a foto.
// Uso: node tools/dev/measure-nav.mjs <largura> <altura>
import sharp from 'sharp';
import { capture } from './shot.mjs';

const [w = 1920, h = 1000] = process.argv.slice(2).map(Number);
const evaluate = `[...document.querySelectorAll('#wd-nav .wd-brand span, #wd-nav .wd-navlinks a.u-link')].map(a => { const b = a.getBoundingClientRect(); return { n: a.textContent.trim(), x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; })`;
const { out, result } = await capture({ name: `nav-medida-${w}`, w, h, wait: 10000, evaluate });
const { data, info } = await sharp(out).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const lin = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
const L = c => .2126 * lin(c[0]) + .7152 * lin(c[1]) + .0722 * lin(c[2]);
const sea = L([30, 48, 72]);
console.log(`${w}×${h}  (${out})`);
for (const r of result) {
  const px = [];
  for (let y = r.y - 4; y < r.y + r.h + 4; y++) for (let x = r.x - 4; x < r.x + r.w + 4; x++) {
    if (x < 0 || y < 0 || x >= info.width || y >= info.height) continue;
    const i = (y * info.width + x) * 3; px.push(L([data[i], data[i + 1], data[i + 2]]));
  }
  px.sort((a, b) => a - b);
  const bg = px.slice(Math.floor(px.length * .45)), worst = bg[Math.floor(bg.length * .05)];
  const ratio = (worst + .05) / (sea + .05);
  console.log(`${r.n.padEnd(16)} ${ratio.toFixed(2)}:1  ${ratio >= 4.5 ? 'AA' : 'ABAIXO'}`);
}
