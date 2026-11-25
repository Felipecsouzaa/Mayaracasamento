# assets/img — origem das imagens

Gerado por `npm run img` (`tools/process-images.mjs`, com sharp). Os originais ficam **uma pasta acima do projeto**
(`C:\Users\Felipe Souza\Documents\Casamento Mayara\`). O antes/depois de cada recorte está em `tools/review/`.
Os `srcset`, as dimensões e os textos alternativos de cada foto estão em `images.json`.

## Fotos

As fotos são **capturas de tela do Instagram** (~550–820 px de largura). O script tira a interface do app:
setas do carrossel (laterais; em `maos` elas ficam ~16 px para dentro), pontinhos de paginação (rodapé),
o selo de usuário (canto inferior direito de `abraçados`) e os filetes pretos de 2–4 px nas bordas.

| Arquivo gerado | Origem | Recorte (x, y, largura × altura) | Saídas |
|---|---|---|---|
| `abracados-*` | `abraçados.PNG` (722 × 548) | 10, 4 · 602 × 508 | `-602.webp`, `-301.webp`, `.jpg` |
| `correndo-praia-*` | `correndo na praia.PNG` (766 × 549) | 20, 3 · 746 × 509 | `-746.webp`, `-373.webp`, `.jpg` |
| `juntos-praia-*` | `juntos na praia.PNG` (771 × 550) | 20, 4 · 724 × 508 | `-724.webp`, `-362.webp`, `.jpg` |
| `maos-*` | `maos se tocando.PNG` (823 × 552) | 54, 5 · 716 × 509 | `-716.webp`, `-358.webp`, `.jpg` |
| `pedido-*` | `pedido de casamento.PNG` (576 × 819) | 24, 3 · 552 × 781 | `-552.webp`, `-276.webp`, `.jpg` |

WebP qualidade 82 em duas larguras (a do recorte e a metade) + JPG (mozjpeg 82) como fallback.

> **Substitua pelas fotos originais do fotógrafo em alta resolução (mínimo 2400 px de largura)**, mantendo os
> mesmos nomes de origem. Depois zere o `crop` de cada item em `tools/process-images.mjs` (as fotos originais não
> têm interface do Instagram), acrescente uma largura intermediária (ex.: 1200) se quiser, e rode `npm run img`.
> Com ~600 px, as atuais ficam suaves em telas grandes e em retina.

## Logo

| Arquivo | Uso |
|---|---|
| `logo-ml.png` | `logo casal mayara.PNG` com o fundo creme removido (alfa pela distância de cor até o papel), cores originais, 1024 × 1024 |
| `logo-ml-sea.png` | monocromático em `--wd-sea` (#1E3048), fundo transparente — para fundos claros |
| `logo-ml-cream.png` | monocromático em `--wd-cream` (#EDE9DF), fundo transparente — para fundos escuros |
| `favicon-32.png` | marinho, transparente |
| `favicon-180.png`, `favicon-512.png` | marinho sobre `--wd-foam` (opaco, para iOS e manifest) |

O logo é raster: não há SVG vetorizado (seria preciso redesenhar ou vetorizar à mão). Se o designer tiver o arquivo
vetorial, coloque-o como `logo-ml.svg` e prefira-o.

## Recorte do casal (hero)

`juntos-praia-recorte.png` **não foi gerado**: o rembg exige Python, que não está instalado nesta máquina.
Para gerar depois: `pip install rembg[cli]` e
`rembg i "juntos na praia.PNG" assets/img/juntos-praia-recorte.png` (ou um recorte manual no Photoshop/Photopea).
Com a resolução atual (~720 px), o recorte ficará serrilhado num hero em tela cheia — vale esperar as fotos originais.
