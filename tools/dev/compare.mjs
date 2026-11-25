// SÓ DESENVOLVIMENTO: capturas comparáveis (antes/depois) do hero, do convite e da festa.
// Uso: node tools/dev/compare.mjs <prefixo> [larguras=1440,390]   → tools/review/<prefixo>-<parte>-<largura>.png
import { capture } from './shot.mjs';

const [prefix = 'cmp', widths = '1440,390'] = process.argv.slice(2);
const H = { 1440: 900, 390: 844 };
/* alvo de rolagem (px) calculado na página: hero no topo, cena 1 com a janela aberta, cena 3, festa */
const PARTS = {
  hero: `0`,
  convite: `(function(){var m=document.getElementById('site-main'),s=document.querySelector('.wd-s1');return s.getBoundingClientRect().top-m.getBoundingClientRect().top+m.scrollTop+(s.offsetHeight-innerHeight)*.75})()`,
  statement: `(function(){var m=document.getElementById('site-main'),s=document.querySelector('.wd-statement');return s.getBoundingClientRect().top-m.getBoundingClientRect().top+m.scrollTop-innerHeight*.35})()`,
  cena3: `(function(){var m=document.getElementById('site-main'),s=document.querySelector('.wd-s3');return s.getBoundingClientRect().top-m.getBoundingClientRect().top+m.scrollTop})()`,
  festa: `(function(){var m=document.getElementById('site-main'),s=document.getElementById('festa');return s.getBoundingClientRect().top-m.getBoundingClientRect().top+m.scrollTop})()`
};
for (const w of widths.split(',').map(Number)) {
  for (const [part, expr] of Object.entries(PARTS)) {
    const evaluate = `new Promise(function(res){var m=document.getElementById('site-main'),y=${expr};
      if(window.WD&&WD.lenis)WD.lenis.scrollTo(y,{immediate:true});else m.scrollTop=y;
      setTimeout(function(){res({y:Math.round(y),at:m.scrollTop,h:m.scrollHeight})},3200)})`;
    const { out, result } = await capture({ name: `${prefix}-${part}-${w}`, w, h: H[w] || 900, wait: 7500, evaluate });
    console.log(out, JSON.stringify(result));
  }
}
