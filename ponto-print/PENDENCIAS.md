# Pendências antes de publicar

Lista do que ainda depende de uma confirmação da Ponto Print. O site já roda
sem nada disso — os campos não confirmados simplesmente não aparecem na página,
em vez de aparecer errados. Cada item diz onde mexer.

## 🔴 Bloqueia a publicação

### 1. Domínio
Ainda não confirmado. É preciso saber:
- se o domínio já foi registrado e qual é;
- em qual registradora está;
- quem tem o login administrativo.

Hoje o site usa `pontoprint.com.br` como marcador. Quando o domínio for
definido, troque tudo de uma vez a partir da pasta do projeto:

```bash
grep -rl 'pontoprint\.com\.br' public/ | xargs sed -i 's|pontoprint\.com\.br|SEUDOMINIO.com.br|g'
```

Isso cobre `canonical`, `og:url`, `og:image`, os dois blocos de JSON-LD,
`sitemap.xml` e `robots.txt`. Depois confira com `grep -rn 'SEUDOMINIO' public/`.

### 2. E-mail para receber os pedidos
Não confirmado. Sugestão levantada: `pontoprintgr@gmail.com`.
Enquanto estiver vazio, a linha de e-mail não aparece no rodapé e o formulário
continua funcionando (grava no banco e o painel mostra).

- Para exibir no site: `public/js/config.js` → `email: 'endereco@dominio'`.
- Para receber cada pedido por e-mail: `.env` → `SMTP_*` e `NOTIFY_EMAIL_TO`.
  Com Gmail é preciso senha de app, não a senha da conta.

### 3. ~~Logo~~ ✅ resolvido

Os arquivos oficiais chegaram e estão aplicados: logo no topo e no rodapé,
favicon e ícone de atalho a partir do monograma "PP", e a paleta do site
agora usa as cores exatas da marca, amostradas do arquivo:

| | |
| --- | --- |
| Ciano | `#1c9dd9` |
| Magenta | `#e50e7e` |
| Amarelo | `#f9eb1e` |
| Preto | `#000000` |

Originais preservados em `marca-original/logos/` (fora de `public/`, não vão
ao ar). As versões que o site usa ficam em `public/assets/marca/`.

**Só falta o vetor.** O que chegou é PNG com transparência, que serve bem para
web. Se existir SVG, AI ou PDF vetorial, vale substituir: fica nítido em
qualquer tamanho e pesa menos. Rode `node scripts/preparar-imagens.mjs` depois
de trocar os originais.

### 4. ~~Fotos reais~~ ✅ resolvido (com ressalvas)

O portfólio está no ar com 8 fotos de trabalhos de verdade: placas em PS 2 mm,
placas de sinalização, adesivos, banners/wind banner, camisetas, canecas,
cadernos e brindes. Mais a foto da loja na seção de endereço.

Originais em `fotos-dos-trabalhos/`, versões publicadas em
`public/assets/portfolio/`. Para trocar qualquer uma, edite a lista no topo de
`scripts/preparar-imagens.mjs` e rode o script.

**Duas categorias importantes ainda sem foto:** **plotagem / grande formato**
(A2, A1, A0, bobina) e **encadernação**. As duas aparecem entre os serviços em
destaque, então valeria fotografar.

**Uma foto ficou de fora de propósito:** o painel de fotos "Kiara & Jose" tem
rostos de pessoas identificáveis. Publicar exige autorização delas, não só do
cliente que encomendou.

**Uma foto publicada merece decisão de vocês:** o caderno com personagem da
Disney. É um trabalho real, mas anunciar no site a personalização de personagem
de terceiro é mais exposto do que fazer a peça sob encomenda. Se preferirem
tirar, me avisem — troco por outra.

### 5. Formas de pagamento
Hoje o FAQ responde "as formas aceitas são confirmadas no atendimento" — está
assim de propósito, para não prometer o que não foi confirmado. Depois de
confirmar (PIX, cartão, dinheiro...), reescrever a resposta em
`public/index.html`, na pergunta "Quais são as formas de pagamento?".

### 6. Política de entrega
O site diz que o trabalho é principalmente com retirada local e que envio ou
entrega é avaliado caso a caso — exatamente o que foi informado. Se houver
política oficial (raio de entrega, valor, prazo), atualizar a pergunta
"Vocês fazem entrega?".

### 7. ~~Imagem de compartilhamento~~ ✅ resolvido

A `og.png` (1200×630) foi refeita com o logo oficial, a assinatura da marca,
três fotos de trabalhos reais e o WhatsApp. É o que aparece quando alguém
manda o link no WhatsApp ou no Instagram.

Para alterar: edite `design/og.html` (é HTML e CSS comum) e rode:

```bash
node scripts/gerar-og.mjs
```

### 8. Razão social e CNPJ
O CNPJ **48.841.667/0001-43** já aparece no rodapé. A razão social ainda não foi
confirmada e por isso não é exibida. Ao confirmar exatamente como consta no
cartão CNPJ: `public/js/config.js` → `razaoSocial: '...'`.

### 9. Endereço completo
Está publicado como "Hilário Pereira de Souza, 492 — Jardins do Brasil,
Osasco - SP". Confirmar o tipo do logradouro (Rua/Avenida) e o CEP e completar
em `public/js/config.js` (`endereco`) e no JSON-LD de `public/index.html`
(`streetAddress` e `postalCode`).

### 10. Redes sociais
Instagram e Facebook não confirmados — a linha "Redes" só aparece no rodapé
quando `instagram` ou `facebook` estiver preenchido em `public/js/config.js`.
Colocar só perfis ativos, que realmente receberão atualização.

### 11. Depoimentos
Nenhum depoimento foi publicado, porque não se inventa avaliação. A seção já
está pronta e comentada dentro de `public/index.html` (procure por
"DEPOIMENTOS (ainda não publicado)"): basta preencher com 3 clientes reais, com
autorização, preferencialmente de categorias diferentes — placas/comunicação
visual, material para empresa e personalizado/impressão.

## 🟢 Recomendado depois de publicar

### 12. Ficha no Google (Perfil da Empresa)
Boa parte dos clientes chega por Google e Google Maps. Vale manter a ficha com
nome, endereço, horário (seg a sex, 8h às 18h), telefone e fotos iguais aos do
site — o Google cruza essas informações. Depois de publicada, trocar o
`mapsUrl` de `public/js/config.js` (hoje é uma busca pelo endereço) pelo link
curto da ficha.

### 13. Medir campanhas
Para saber de onde vem cada visita, use links com `utm_source`:
`https://SEUDOMINIO.com.br/?utm_source=instagram` (ou `google`, `cartao`,
`status-whatsapp`). Aparece em "De onde vêm as visitas" no painel `/admin`.

### 14. Tipografia Objektiva
A identidade usa Objektiva, que é licenciada. O site carrega **Archivo** como
substituta próxima e usa a Objektiva automaticamente se ela existir na máquina.
Havendo licença web, colocar os `.woff2` em `public/assets/fonts/` e descomentar
o bloco `@font-face` no topo de `public/css/styles.css`.

### 15. Serviços que não devem ser prometidos
O site foi escrito para **não** afirmar produção própria de offset industrial,
impressão UV, látex, solvente, grandes tiragens industriais, verniz localizado
ou laminação soft touch. Há um aviso de transparência ao final da lista de
serviços dizendo que parte dos acabamentos especiais é feita com parceiros.
Se um desses processos passar a ser produzido internamente, aí sim vale
atualizar o texto.
