# Site do casamento — Mayara & Lucas

Regras permanentes para todas as etapas.

## Fonte da verdade
- `assets/design_system.html` é a fonte da verdade visual. Reutilize classes e tokens dele; não invente estilos paralelos.
- A base já extraída fica em `assets/css/wd-tokens.css`, `wd-base.css`, `wd-components.css` e `assets/js/wd-core.js` (`window.WD`). Não edite esses arquivos para uma seção; o específico do site vai em `assets/css/site.css` e `assets/js/site.js`.
- Classes novas só com o prefixo `wd-` e somente em `site.css`.
- Paleta do site: títulos e lettering em `--wd-heading` (= `--wd-sea` #1E3048; vira creme em `.is-night`/`.is-sea`), texto corrido em `--wd-ink-body`, champanhe como único acento. Texto pequeno em marinho suave usa `--wd-sea-text`, nunca `--wd-sea-soft`.
- O site não depende das pastas de referência (`*-design-system/`, `assets/referencias/`): bibliotecas, fontes e imagens vêm de `assets/vendor` e `assets/img`. Do modelo AURELIA só entram os efeitos já reescritos em `wd-core.js` / `wd-motion.js` / `site.css`; os JS dele não são incluídos.

## Tipografia
- `--wd-sans` = Inter 300/400/500 (woff2 latin local, preload do 300). Corpo em 300 com line-height 1.75; UI e botões em 400/500 com tracking .06–.16em (eyebrow .22em, botão .16em, nav .08em).
- `--wd-serif` = Cormorant Garamond (variável, 300–500, normal e itálico): itálicos, citações e `.wd-t-lead` (textos de abertura de cada seção, no lugar do body-lg).
- `--wd-serif-display` só nos nomes e nos títulos gigantes (`.wd-names`, títulos das cenas, `.wd-statement`, `.wd-ghost`). Escolha feita em `docs/teste-fontes.html`.
- Nunca usar as fontes Elicyon nem Antique Legacy (proprietárias, sem licença). Fontes novas só gratuitas (OFL), locais e em subset latin. Peso total de fontes carregadas < 250 KB.

## Classes AURELIA (em `site.css`)
- Eyebrow com fio de 22px (`.wd-t-eyebrow` + `<i>`; variante `.dot`); `.wd-t-lead`.
- Botões: `.wd-btn--gilt` (gradiente #9A7B45 → #C9A25A + brilho diagonal; texto `--wd-night` para passar AA; reservado ao envio do RSVP — o CTA do hero é azul), `.wd-btn--glass` (borda cônica girando, `@property --wd-border-angle`; só sobre fundo claro, nunca em botão azul), `.wd-btn-line` (sublinhado, ícone se afasta 6 → 12px).
- Fundos: `.wd-orb` (`--gold`/`--sea`/`--foam`; 1–2 por seção clara, no lugar da `.wd-breath`), grain em SVG no `body::after` (camada própria), `[data-wd-stars]` + `.wd-night-glow` nas seções noturnas, `.wd-ghost` (monograma gigante a 4%).
- Cards: `.wd-card` / `.wd-card-ic`, `.wd-icon-cell` (elevação −6/−4px, borda champanhe, ícone rotate(−6deg) scale(1.08)).
- Cursor: uma única seta dourada, delicada (sem ponto de rastro, anel, blend ou pílula); cresce 1.25× em links e fotos; rótulo em texto pequeno ao lado (`#wd-cursorLabel`) só em alvos sem texto próprio (fotos, player).

## Dados do casamento
- Casal: Mayara & Lucas (monograma “ML”).
- Data: 01 · 06 · 2027 (1º de junho de 2027) · cerimônia às 18h00 · `DATA_ISO` 2027-06-01T18:00:00-03:00.
- Local: a definir (praia).

## Conteúdo
- Textos em pt-BR, tom afetivo e elegante. Sem lorem ipsum. Nunca reproduzir letras de música.
- Alt descritivo em português em toda imagem informativa (`assets/img/images.json` já traz os das fotos).

## Cada seção
- Fundo vivo: `.wd-section` com `is-paper` / `is-foam` / `is-washi` / `is-night` / `is-sea` + grain global + um elemento animado sutil em `.wd-bg` (orbes `.wd-orb`, pétalas `canvas[data-wd-petals]`, estrelas na noite, parallax). Movimento declarado com `data-wd-reveal` (ver `docs/movimento.md`).
- Surgimento ao entrar em vista (`.wd-rise`) e microinteração em tudo que é clicável.
- Movimento: `--wd-ease-out`, `--wd-ease-inout`, `--wd-ease-snap`; durações `.35s / .75s / 1.1s / 5s`. Exceções: `elastic.out(1,.4)` só no magnético, linear só em marquee, rotação e scrub.
- `prefers-reduced-motion` respeitado em tudo (estado final, sem Lenis, pins, pétalas, WebGL em loop).

## Técnica
- Mobile first, de 360 px a 1920 px.
- Imagens com `srcset`, `loading="lazy"` (exceto a primeira dobra) e `decoding="async"`.
- WebGL e canvas só renderizam quando estão em vista.
- Acessibilidade: foco visível champanhe, `aria-*` nos interativos, contraste AA em todo texto informativo.
- Testar sempre pelo servidor local (`npm run serve`, configuração `site` em `.claude/launch.json`), nunca por `file://` (as texturas WebGL quebram).

## Ao final de cada etapa
Abrir no navegador, conferir o console sem erros e sem 404, testar em 390 px e em 1440 px e mostrar o resultado antes de seguir.
