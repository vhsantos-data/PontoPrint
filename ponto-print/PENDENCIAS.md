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

### 3. Logo em vetor
O site desenha a marca "Ponto•Print" em CSS (texto + ponto magenta). Assim que
chegar o arquivo oficial (SVG, AI ou PDF vetorial — ou PNG grande com fundo
transparente), substituir:
- topo e rodapé: os dois blocos `<a class="brand">` em `public/index.html`;
- favicon: `public/assets/favicon.svg`;
- imagem de compartilhamento: `design/og.html` (ver item 7).

### 4. Fotos reais dos trabalhos
As 8 imagens do portfólio são placeholders com o aviso "substituir por foto
real". Trocar por fotos de trabalhos de verdade da Ponto Print:
- mínimo 8, horizontais, proporção próxima de 4:3;
- boa iluminação, fundo limpo;
- JPG ou WebP, cerca de 1200px de largura;
- salvar em `public/assets/portfolio/` e apontar o `src` em `public/index.html`.

Já estão previstas: placas em PS 2 mm, adesivos em vinil, plotagem, impressão
fotográfica, banners/lonas, canecas, cadernos/agendas, cartões/panfletos.
Faltam cobrir das sugestões: **encadernações** e **camisetas**.

**Importante:** manter o texto do `alt` de cada imagem descrevendo o material.
Ele conta para acessibilidade e para o Google.

## 🟡 Confirmar antes de prometer no site

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

### 7. Imagem de compartilhamento (og.png)
Já existe uma arte tipográfica pronta em `public/assets/og.png` (1200×630), com
a marca, a frase "Impressão que dá vida às suas ideias." e o WhatsApp. A versão
ideal, quando houver foto boa, leva **foto de um trabalho real + logo + frase**.

Para regerar depois de editar `design/og.html`:
```bash
npm i -D playwright && npx playwright install chromium
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
