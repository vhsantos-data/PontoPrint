# Ponto Print — site + API de orçamentos

Landing page de rolagem contínua (hero → materiais → diferenciais → portfólio → ajuda → como funciona → FAQ → orçamento) com CTAs de WhatsApp contextuais, formulário que grava no banco e notifica, e um painel simples para acompanhar os pedidos.

## Stack

- **Backend:** Node 22+ e Express 5. Banco SQLite embutido no Node (`node:sqlite`) — sem dependência nativa, sem servidor de banco.
- **Frontend:** HTML, CSS e JS puros, sem build. Fonte Bricolage Grotesque (Google Fonts).
- **Deploy:** `npm start`, PM2 ou Docker (Dockerfile e compose inclusos).

```
server/
  index.js            app Express, static, erros, shutdown
  config.js           .env validado (falha cedo se faltar algo em produção)
  db.js               schema + queries parametrizadas
  routes/leads.js     POST /api/orcamento
  routes/admin.js     GET/PATCH /api/admin/leads, export CSV
  services/notify.js  webhook + e-mail (opcionais)
  middleware/security.js  helmet/CSP, rate limits, auth do painel, hash de IP
public/
  index.html, css/styles.css, js/main.js, js/config.js
  admin/              painel de pedidos (token)
  assets/portfolio/   placeholders — trocar por fotos reais
```

## Rodando

```bash
cp .env.example .env
npm run gen:token   # cole em ADMIN_TOKEN
npm run gen:token   # cole em IP_HASH_SALT
npm install
npm run dev         # http://localhost:3000  (recarrega ao salvar)
```

Painel: `http://localhost:3000/admin` → cole o `ADMIN_TOKEN`.

## O que ajustar antes de publicar

1. **`public/js/config.js`** — número do WhatsApp (só dígitos, com 55), Instagram, endereço, horário e as mensagens pré-preenchidas de cada botão.
2. **`public/index.html`** — trocar `pontoprint.com.br` nas metas/canonical/JSON-LD pelo domínio real; conferir textos do FAQ (prazo, pagamento, entrega são suposições razoáveis, não regras da loja).
3. **`public/assets/portfolio/*.svg`** — substituir por fotos reais (JPG/WebP ~1200px, 4:3). Manter o `alt` descritivo.
4. **`public/assets/og.png`** — criar imagem 1200×630 para compartilhamento (WhatsApp/Instagram usam).
5. **`.env`** — `PUBLIC_URL`, `TRUST_PROXY=1` se estiver atrás de Nginx/Caddy/Cloudflare/Railway, e as notificações que quiser.
6. Ao alterar CSS/JS em produção, troque o `?v=1` nos links do HTML (cache de 1 dia nos estáticos).

## API

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| `POST` | `/api/orcamento` | — | Recebe o formulário. 201 `{ok, id}`, 422 `{erro, campos}`, 429 rate limit |
| `GET` | `/api/admin/leads?status=&q=&limit=&offset=` | Bearer | Lista + resumo por status |
| `GET` | `/api/admin/leads.csv?status=&q=` | Bearer | Exporta CSV (UTF-8 com BOM, `;`) |
| `PATCH` | `/api/admin/leads/:id` | Bearer | `{status}` ∈ novo, contatado, orcado, fechado, perdido, spam |
| `GET` | `/health` | — | Uptime |

Payload do webhook (`NOTIFY_WEBHOOK_URL`): `{ "evento": "novo_orcamento", "lead": { id, created_at, nome, telefone, email, tipo, quantidade, mensagem, origem, status } }`. Serve direto em n8n, Make ou Zapier para mandar aviso no WhatsApp/Telegram ou gravar em planilha.

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
