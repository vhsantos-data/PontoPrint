# Ponto Print — site + API de orçamentos

Landing page de rolagem contínua (hero → serviços em destaque → lista completa → diferenciais → portfólio → público e região → como funciona → FAQ → contato) com CTAs de WhatsApp contextuais, formulário que grava no banco e notifica, métricas próprias de visita (sem cookies) e um painel para acompanhar visitas, cliques e pedidos.

O WhatsApp **(11) 91969-3833** é o canal principal de conversão: cada botão da página abre a conversa já com a mensagem do contexto onde foi clicado, e o formulário termina oferecendo continuar no WhatsApp com o pedido preenchido.

> **Antes de publicar, leia [PENDENCIAS.md](PENDENCIAS.md).** Domínio, e-mail de
> pedidos, logo vetorial e fotos reais dos trabalhos ainda dependem de
> confirmação. O que não foi confirmado não aparece no site em vez de aparecer
> errado.

## Identidade

Fundo branco, preto como cor principal e CMYK (ciano, magenta, amarelo) em uso
pontual: filetes finos, marcações de seção e realces. Tipografia da marca é a
**Objektiva**; como é licenciada, a web carrega **Archivo** como substituta
próxima e passa a usar a Objektiva sozinha se ela estiver instalada ou for
auto-hospedada (ver topo do `public/css/styles.css`).

## Stack

- **Backend:** Node 22+ e Express 5. Banco SQLite embutido no Node (`node:sqlite`) — sem dependência nativa, sem servidor de banco.
- **Frontend:** HTML, CSS e JS puros, sem build. Fonte Archivo (Google Fonts), com Objektiva na frente da pilha.
- **Deploy:** `npm start`, PM2 ou Docker (Dockerfile e compose inclusos).

```
server/
  index.js            app Express, static, erros, shutdown
  config.js           .env validado (falha cedo se faltar algo em produção)
  db.js               schema + queries parametrizadas
  routes/leads.js     POST /api/orcamento
  routes/admin.js     GET/PATCH /api/admin/leads, export CSV, GET /api/admin/metricas
  routes/eventos.js   POST /api/evento (beacon de visita/clique)
  services/notify.js  webhook + e-mail (opcionais)
  middleware/security.js  helmet/CSP, rate limits, auth do painel, hash de IP
public/
  index.html, css/styles.css, js/main.js, js/config.js
  admin/              painel de pedidos (token)
  assets/og.png       imagem de compartilhamento (1200x630)
  assets/portfolio/   placeholders — trocar por fotos reais
design/og.html        arte da og.png, em HTML/CSS
scripts/gerar-og.mjs  regera a og.png a partir do design/og.html
```

## Rodando

```bash
npm install
node scripts/preparar-env.mjs   # cria o .env e mostra o token do painel
npm run dev                     # http://localhost:3000 (recarrega ao salvar)
```

Painel: `http://localhost:3000/admin` → cole o `ADMIN_TOKEN` que o script
mostrou (ou `grep ADMIN_TOKEN .env`).

Sem `.env` o servidor sobe do mesmo jeito em desenvolvimento, com um token
fraco e um aviso no terminal. Em produção ele se recusa a subir sem
`ADMIN_TOKEN` (32+ caracteres) e `IP_HASH_SALT`.

## O que ajustar antes de publicar

A lista completa, com o motivo de cada pendência, está em
**[PENDENCIAS.md](PENDENCIAS.md)**. Resumo:

1. **`public/js/config.js`** — é o único arquivo que a Ponto Print precisa editar
   no dia a dia: WhatsApp, endereço, horário, e-mail, redes, CNPJ, razão social,
   link do mapa e as mensagens de cada botão. Campo vazio (`''`) some da página.
2. **Domínio** — trocar `pontoprint.com.br` em metas, JSON-LD, `sitemap.xml` e
   `robots.txt` (há um comando pronto no PENDENCIAS.md).
3. **`public/assets/portfolio/*.svg`** — substituir pelos trabalhos reais
   (JPG/WebP ~1200px, 4:3). Manter o `alt` descritivo.
4. **`public/assets/og.png`** — já existe uma arte tipográfica; a definitiva leva
   foto de trabalho real. Editar `design/og.html` e rodar `node scripts/gerar-og.mjs`.
5. **FAQ** — as respostas de pagamento e entrega estão propositalmente abertas
   ("confirmamos no atendimento"). Fechar o texto quando a política for definida.
6. **`.env`** — `PUBLIC_URL`, `TRUST_PROXY=1` se estiver atrás de
   Nginx/Caddy/Cloudflare/Railway, e as notificações que quiser.
7. Ao alterar CSS/JS em produção, troque o `?v=3` nos links do HTML (cache de 1
   dia nos estáticos).

## Serviços e tipos de pedido

O `<select>` do formulário, o `TIPOS` de `server/routes/leads.js`, o `tipoLabel`
de `public/js/main.js` e o do painel precisam andar juntos. Hoje são:
`placas`, `adesivos`, `plotagem`, `fotos`, `impressao`, `grafica`, `acabamento`,
`personalizados`, `arte`, `nao-sei`. Pedidos antigos (`empresa`, `evento`,
`personalizado`) continuam aparecendo no painel marcados como "(antigo)".

O site não afirma produção própria de offset industrial, UV, látex, solvente,
grandes tiragens, verniz localizado ou laminação soft touch — há um aviso de
transparência dizendo que parte dos acabamentos especiais é feita com parceiros.
Manter assim ao editar textos.

## API

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| `POST` | `/api/orcamento` | — | Recebe o formulário. 201 `{ok, id}`, 422 `{erro, campos}`, 429 rate limit |
| `GET` | `/api/admin/leads?status=&q=&limit=&offset=` | Bearer | Lista + resumo por status |
| `GET` | `/api/admin/leads.csv?status=&q=` | Bearer | Exporta CSV (UTF-8 com BOM, `;`) |
| `PATCH` | `/api/admin/leads/:id` | Bearer | `{status?, valor?, obs?}` — status ∈ novo, contatado, orcado, fechado, perdido, spam |
| `POST` | `/api/evento` | — | Beacon de métricas `{tipo: pageview|cta, rotulo?, ref?, utm?}`. Sempre 204 |
| `GET` | `/api/admin/metricas?dias=30` | Bearer | KPIs, série diária, cliques por botão, origens, dispositivos, funil |
| `GET` | `/health` | — | Uptime |

Payload do webhook (`NOTIFY_WEBHOOK_URL`): `{ "evento": "novo_orcamento", "lead": { id, created_at, nome, telefone, email, tipo, quantidade, mensagem, origem, status } }`. Serve direto em n8n, Make ou Zapier para mandar aviso no WhatsApp/Telegram ou gravar em planilha.

## Painel (`/admin`)

**Visão geral** — visitantes hoje / 7 dias / período, cliques no WhatsApp e % de visitantes que clicam, pedidos e conversão, fechados com valor somado; gráfico diário; qual botão de WhatsApp mais converte; de onde vêm as visitas (referrer ou `utm_source`); dispositivo; pedidos por tipo; funil por status com valor.

**Pedidos** — lista com filtro, busca e paginação; status; valor orçado e observações internas por pedido; export CSV.

**Como as métricas funcionam** — o próprio site manda um beacon (`/api/evento`) ao abrir a página e ao clicar em qualquer botão de WhatsApp. Sem cookie, sem Google Analytics. Cada visitante vira `hash(sal + dia + IP + navegador)`, que muda todo dia: dá para contar pessoas no dia sem conseguir seguir ninguém entre dias. Bots conhecidos são ignorados. Eventos brutos expiram após `EVENTOS_RETENCAO_DIAS` (padrão 180).

Para medir campanhas, use links com `?utm_source=instagram` (ou `google`, `cartao`, `whatsapp-status`...) — aparece em "De onde vêm as visitas".

## Segurança — o que já está feito

- **Cabeçalhos** via Helmet: CSP restrita (sem script/style inline, fontes só do Google Fonts), `frame-ancestors 'none'`, HSTS em produção, Referrer-Policy.
- **Rate limit** por IP: 120 req/15 min na API, 6 envios/10 min no formulário, 60 tentativas/15 min no painel.
- **Validação** de tudo que entra com Zod: tamanhos máximos, enum de tipo, telefone normalizado, remoção de caracteres de controle, corpo JSON limitado a 16 KB.
- **Anti-bot** sem CAPTCHA: honeypot, tempo mínimo de preenchimento e bloqueio do mesmo telefone repetido. Bots recebem "sucesso" falso para não aprenderem o filtro.
- **SQL** sempre parametrizado; nenhum valor do usuário entra no texto da query.
- **Painel** protegido por token longo comparado em tempo constante; token fica só em `sessionStorage` (some ao fechar a aba). Painel e API com `noindex` e bloqueados no `robots.txt`.
- **Saída segura**: painel renderiza tudo com `textContent`; CSV escapa aspas e neutraliza células começando com `= + - @` (injeção de fórmula no Excel); e-mail de aviso vai em texto puro.
- **Config falha cedo**: em produção o servidor não sobe sem `ADMIN_TOKEN` (≥ 32) e `IP_HASH_SALT`.
- **LGPD**: consentimento explícito no formulário, IP guardado só como hash com sal, texto de privacidade no rodapé, dados técnicos não saem no webhook/e-mail.
- Sem `x-powered-by`, erros não vazam stack, `.env` e banco fora do git.

## Segurança — o que fica com você na hospedagem

- HTTPS com certificado válido (Caddy faz sozinho; Nginx + Certbot também). O app redireciona HTTP→HTTPS quando `TRUST_PROXY=1`.
- Backup do arquivo `data/pontoprint.db` (cópia diária basta; use `sqlite3 pontoprint.db ".backup copia.db"` para cópia consistente).
- Rotacionar o `ADMIN_TOKEN` se alguém que tinha acesso sair.
- Manter dependências atualizadas: `npm audit` e `npm outdated` de vez em quando.
- Política de retenção: apague leads antigos (ex.: `DELETE FROM leads WHERE created_at < date('now','-12 months')`) ou agende isso no cron.

## GitHub Codespaces

O `.devcontainer/devcontainer.json` fica na **raiz do repositório** (é onde o
Codespaces procura), apontando para esta pasta: Node 22, porta 3000
encaminhada, `npm install` e `.env` criados sozinhos.

1. No GitHub: **Code → Codespaces → Create codespace** (escolha a branch).
2. O terminal já abre em `ponto-print/`. Espere o `postCreateCommand`
   terminar: ele instala as dependências e roda
   `node scripts/preparar-env.mjs`, que cria o `.env` já com `ADMIN_TOKEN` e
   `IP_HASH_SALT` gerados. **O token do painel aparece no terminal** — copie,
   ou leia depois com `grep ADMIN_TOKEN .env`.
3. Rode o servidor:
   ```bash
   npm run dev
   ```
4. A porta 3000 é encaminhada automaticamente e o Codespace abre a prévia.
   Se não abrir, vá na aba **Ports** e clique no ícone de globo da porta 3000.
5. Painel em `/admin` — cole o token do passo 2.

**Para outra pessoa ver o site** (cliente, por exemplo): aba **Ports** → clique
com o botão direito na porta 3000 → **Port Visibility → Public**. Sem isso, a
URL pede login do GitHub. Lembre de voltar para Private depois.

Se o Codespace abrir **sem** o devcontainer (imagem padrão), o terminal começa
na raiz do repositório, onde não há `package.json` — `npm run dev` falha com
`ENOENT`. Nesse caso:

```bash
cd ponto-print
node -v                          # precisa ser 22.13+
                                 # se não for: nvm install 22 && nvm use 22
npm install
node scripts/preparar-env.mjs
npm run dev
```

## Deploy

**PM2:**
```bash
npm ci --omit=dev
NODE_ENV=production pm2 start npm --name ponto-print -- start
```

**Docker:**
```bash
docker compose up -d --build
```

**Nginx (trecho):**
```nginx
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```
