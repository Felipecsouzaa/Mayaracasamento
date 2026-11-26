# Movimento — auditoria da camada global

Motor: `assets/js/wd-motion.js` (`window.WDM`), GSAP 3.12.5 + ScrollTrigger, scroller `#site-main`, Lenis
(`lerp .085`, `wheelMultiplier .9`, `syncTouch false`), `lenis.on('scroll', ScrollTrigger.update)` no mesmo ticker.
Toda animação ligada ao scroll usa ScrollTrigger com `scrub: 1.2`. `ScrollTrigger.refresh()` roda após `document.fonts.ready`,
e no `load` (não a cada imagem: o refresh no meio da rolagem fazia as frases presas ao scroll piscarem; as fotos têm tamanho fixo e não mudam o layout). Só se animam `transform`, `opacity`, `clip-path` e `filter`
(blur ≤ 8px); o `will-change` entra no início e sai no fim de cada revelação.

## API declarativa

| `data-wd-reveal` | O que faz | Duração / easing / stagger |
|---|---|---|
| `lines` | divide em linhas medidas depois do layout, cada uma numa máscara; yPercent 110 → 0, rotate 1.5 → 0; brilho nos itálicos | 1.2s · power4.out · .08 |
| `words` | opacity 0 → 1, yPercent 40 → 0, blur 6 → 0 | 1s · power3.out · .04 |
| `chars` | opacity 0 → 1, letter-spacing .4em → valor final | .9s · power3.out · .015 |
| `para` | linhas com opacity 0 → 1, y 18 → 0, blur 4 → 0 | .9s · power2.out · .06 |
| `caption` | fio champanhe 0 → 32px, depois o texto por clip-path | .5s + .8s power3.inOut |
| `image` | cortina `inset(100% 0 0 0)` → 0; imagem scale 1.25 e blur 6 → 1 e 0; depois paralaxe ±6% em scrub | 1.3s · power4.inOut |
| `fade` | opacity 0 → 1, y 12 → 0 | .7s · power2.out |
| `draw` | stroke-dashoffset 1 → 0 | 1.4s · power3.inOut |
| `count` | odômetro, dígito por dígito | 1.6s · power3.out · .06 |
| `hero` | heroUp (AURELIA): cada filho sobe yPercent 40 → 0, blur 8 → 0, opacity 0 → 1 | 1.1s · expo.out (≈ cubic-bezier(.16,1,.3,1)) · .17 |
| `lit` | frase que acende palavra por palavra: opacity .12 → 1; `[data-gold]` em `--wd-gold-text` | .5s por palavra · 55ms entre palavras · preso ao scroll com `data-wd-scrub` |

Modificadores: `data-wd-delay`, `data-wd-stagger`, `data-wd-start` (padrão `top 85%`, com `clamp()`; `open` = ao abrir o envelope),
`data-wd-scrub` (+ `data-wd-end`, padrão `top 35%`), `data-wd-trigger` (outro elemento como gatilho), `data-wd-range`
(fração do percurso de uma cena com pin), `data-wd-parallax="none"` (em `image`), `data-wd-skew`, `data-wd-thread`, `data-wd-cursor`.

Coreografia por bloco: eyebrow (`chars`) → título (`lines`/`words`) → imagem/desenho → parágrafo/contagem → legenda → botões (`fade`),
com .12s entre cada degrau, terminando em até 1.6s. Os itálicos recebem um brilho champanhe único (1.4s) depois do título, exceto os que já têm animação própria (o glow do “você”), para um não interromper o outro.

## Tabela por seção

| Seção | Elemento | Animação aplicada | Gatilho |
|---|---|---|---|
| `#abertura` | envelope, monograma, selo | sequência própria do preloader (site.js) | carregamento / clique |
| `#abertura` | selo e botões | magnético .15× (solta com elastic.out(1,.4)); no mobile “Abrir o convite” fica fixo no rodapé da tela | ponteiro |
| global | `body` / seções `[data-wd-bg]` | `--wd-page-bg` interpola a cor da seção anterior para a próxima | scrub 1.2, `top 60%` → `top 40%` da seção |
| global | navbar e player | tema `nav--night` + `body.wd-theme-dark` sobre seções `night`/`sea` | seção sob a navbar (a cada scroll) |
| global | fio dourado `.wd-thread` (.8px, gilt, opacity .5) | stroke-dashoffset 1 → 0, passando ao lado dos títulos `[data-wd-thread]` | scrub 1.2, progresso total do `#site-scroller` |
| global | títulos `lines`/`words` ≥ 40px e `[data-wd-skew]` | skewY pela velocidade (máx. 1.5deg), volta em .6s power3.out | velocidade do Lenis |
| global | marquee `[data-css-marquee-list]` | acelera até 5× com a velocidade | velocidade do Lenis |
| global | `.wd-bg` e `.wd-interlude` claros | orbes `.wd-orb` (blur 60px, opacity .5, drift 22/28/32s) no lugar da respiração | contínuo (ambiente) |
| global | grain | SVG feTurbulence em `body::after` (opacity .03, 220px), estático numa camada própria | — |
| global | indicador de scroll | linha champanhe → transparente, `scrollp` 2s | contínuo |
| global | `.wd-btn--gilt` | brilho diagonal atravessa em .75s | hover / foco |
| global | `.wd-btn--glass` | borda cônica girando (4s linear) | contínuo |
| global | `.wd-btn-line` | gap do ícone 6 → 12px + cor ouro | hover / foco |
| global | `.wd-card` · `.wd-icon-cell` | elevação −6 / −4px, borda champanhe, sombra; ícone rotate(−6deg) scale(1.08) | hover |
| global | `.btn-w`, `.wd-seal`, `.wd-player`, `.wd-modal-close` | magnético .15× | ponteiro fino |
| global | links e âncoras `[data-wd-goto]` | Lenis `scrollTo` 1.8s expo.inOut; ao chegar, o título de destino refaz a coreografia | clique |
| global | fotos dentro de links | hover scale 1.03 (.75s ease-out) | ponteiro |
| global | cursor | uma seta dourada delicada; cresce 1.25× em links e fotos; rótulo em texto pequeno ao lado (Ver · Arraste · Ouvir · Pausar) só em alvos sem texto próprio | ponteiro sobre o alvo |
| `#inicio` | nomes (Mayara vazado · & sólido itálico · Lucas vazado, zigue-zague) | `hero` (heroUp) | `open`, delay .1 |
| `#inicio` | fantasma “M & L” (26vw, marinho a 4%) | paralaxe yPercent 0 → −18 | scrub 1.2 |
| `#inicio` | CTA “Confirmar presença” | azul; no mobile vira botão fixo embaixo, azul translúcido (`.wd-fab`), some com o menu aberto | hover / sempre visível no mobile |
| `#inicio` | eyebrow “Com alegria, convidamos você” | `chars` | `open`, delay .25 |
| `#inicio` | data | `words` | `open`, delay .9 |
| `#inicio` | divisórias | `fade` | `open`, delay .9 |
| `#inicio` | dias · horas · minutos | `count` (odômetro); a cada minuto só rola o dígito que mudou (`WDM.countTo`) | `open`, delay .9 |
| `#inicio` | local | `para` | `open`, delay .9 |
| `#inicio` | CTA “Confirmar presença”, selo Agenda, “ROLE” | `fade` | `open`, delay .9 / 1 / 1.1 |
| `#inicio` | conteúdo, zoom WebGL, preenchimento dos nomes | translate/opacity, zoom 1 → 1.14, `--fill` | scrub 1.2, `#convite` `top bottom` → `top top` |
| `#convite` | folha | cantos 32px (22px no mobile) → 0 | scrub 1.2, `top 60%` → `top top` |
| `#convite` · cena 1 | janela da foto | clip-path `inset(18% 30%)` → 0, scale 1.25 → 1 | pin sticky, scrub 1.2, `.wd-s1` `top top` → `bottom bottom` |
| `#convite` · cena 1 | eyebrow “— 01 · O convite” | `chars` em scrub | 22% → 40% do pin |
| `#convite` · cena 1 | título “Depois de tantos pores do sol juntos,” | `lit` em scrub + skew + fio | 24% → 80% do pin |
| `#convite` · cena 2 | foto das mãos | `image` (cortina, sem paralaxe extra) + paralaxe vertical oposta | `top 85%`; scrub 1.2 da cena |
| `#convite` · cena 2 | “juntos” (contorno ↔ preenchimento) | `fade`; desliza xPercent −8 → 8 com troca exata na borda da foto | `.wd-s2` `top 70%`; scrub 1.2 |
| `#convite` · cena 2 | “decidimos transformar o nosso para sempre em um dia” | `lines` + brilho no itálico + fio | `top 85%` |
| `#convite` · cena 3 | foto | paralaxe `--py` ±6.4% (`data-wd-speed .8`) | scrub 1.2 |
| `#convite` · cena 3 | moldura de papel | `--wd-f` 0 → 1 (8vh × 6vw) | scrub 1.2, `top bottom` → `top 5%` |
| `#convite` · cena 3 | “— e queremos você lá.” | `lines` + brilho no itálico + fio | `top 75%` |
| `#convite` · cena 3 | data · abertura (`.wd-t-lead`) · “Ver o grande dia” (`.wd-btn-line`) | `chars` · `para` · `fade` | `top 85%` (clamp), delay .5 |
| `#convite` · statement | “Pés na areia, coração no mar, dizemos sim.” | `lit` em scrub + fio; 2 orbes (ouro e mar) | `top 80%` → `center 45%` |
| `#convite` | último bloco | profundidade na saída desligada: o statement já é uma frase presa ao scroll (`lit`) e as duas se sobrepunham | — |
| `#convite` | intervalos | pétalas (7) + respiração | em vista |
| `#historia` · `#galeria` | fundo | `washi` | — (seções ainda vazias) |
| `#festa` | eyebrow · título · abertura | `chars` · `lines` · `para` | `top 85%` |
| `#festa` | fundo noite | 120 estrelas (50 no mobile) #EAD9B5 piscando com duração e atraso aleatórios + glow dourado no canto + 6 pétalas cor de lanterna | contínuo, em vista |
| `#rodape` | fantasma “M & L” (24vw, creme a 4%) | paralaxe yPercent 0 → −18 | scrub 1.2 |
| `#cerimonia` · `#rsvp` | folha | cantos 32 → 0 | scrub 1.2 (quando tiverem conteúdo) |

## Removido (duplicado ou antigo)

- `site.js`: `heroFade` (opacity/y própria), linha dourada do hero `#wd-heroLine` e seu SVG `.wd-goldline` (substituída pelo fio contínuo).
- `site.js`: scroll do hero em `WD.onScroll` → proxy ScrollTrigger com scrub 1.2.
- `site.js`: `paint()` da contagem → odômetro do motor.
- `site.js`: `sheetRadius`, `splitWords` (título da cena 1), `splitLines` + `whenVisible` (cena 2 e cena 3), `conviteFrame` em `WD.onScroll`.
- `site.js`: detecção de seção noturna na navbar (agora vem de `data-wd-bg`).
- HTML: `data-wd-magnet` (o motor aplica .15× em todos os botões; antes eram .3×), `.wd-rise` no véu da cena 3, `data-wd-lines`, spans `.wd-s3-l`.
- `wd-core.js`: paralaxe própria desligada por `WD.parallaxOff()` (a do motor a substitui).

## Limites

- **Mobile (< 768px):** sem blur, staggers 30% menores, pin da cena 1 de 140svh (180svh no desktop), folha com 22px.
- **`prefers-reduced-motion`:** estado final; sem Lenis, pins, skew, paralaxe, fio animado, pétalas, Ken Burns ou WebGL em loop; sem orbes em movimento, estrelas piscando (ficam fixas a .55), borda girando ou brilho de botão; só fades de .3s.
- Sem bounce/elastic fora do magnético; nada passa de 1.8s, exceto ambiente (respiração, Ken Burns) e scrub.

## Verificação (Chrome headless, rolagem real pela roda do mouse via Lenis, topo → rodapé)

| Largura | Quadros | p50 | p99 | Máx. | > 50 ms | Console | 404 |
|---|---|---|---|---|---|---|---|
| 1440 × 900 | 443 | 17 ms | 17 ms | 50 ms | 0 | limpo | nenhum |
| 390 × 844 | 380 | 17 ms | 17–33 ms | 50–66 ms | 0–1* | limpo | nenhum |

\* Um único quadro de 52–55 ms, sem script na atribuição (long-animation-frame), no primeiro passo da rolagem, quando as fotos
do convite rasterizam pela primeira vez. Nenhum quadro longo durante o restante da rolagem.

Ferramenta: `node tools/dev/motion-check.mjs <largura> <altura> perf|frames|rm` (com `npm run serve` rodando).

## Gravações

Rolagem do topo ao rodapé pela roda do mouse (Lenis), um quadro a cada passo de 12% da altura da tela:
`docs/gif/rolagem-1440.gif` (1440 × 900, reduzido para 720 px) e `docs/gif/rolagem-390.gif` (390 × 844).
Nas duas capturas: console sem erros, nenhuma resposta ≥ 400 e todos os elementos `[data-wd-reveal]` visíveis ao final.


## Revisão anti-pisca

`node tools/dev/flicker-check.mjs <largura> <altura>` abre o convite, rola até o rodapé e acompanha a opacidade de cada `[data-wd-reveal]` quadro a quadro. Aponta textos que aparecem → somem → voltam e alvos do GSAP com `transition` CSS concorrente. Correções desta revisão:
- o refresh do ScrollTrigger a cada foto carregada (com `invalidateOnRefresh`) zerava as frases em scrub, que voltavam em 1.2s — removidos;
- `.wd-btn` tinha `transition` em `transform`, que brigava com a entrada e o magnético do GSAP — agora só cor, fundo e sombra;
- o brilho dos itálicos não substitui mais o glow do “você”;
- o recuo de saída não se aplica a blocos com animação em scrub (o statement chegava a só 82% no celular).
